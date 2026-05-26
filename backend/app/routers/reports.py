"""
Phase 7 + 8: Reports + Batch Release + Analytics
- Live dashboard statistics
- EBR Batch Record PDF  (21 CFR Part 11 compliant)
- Batch Release Certificate PDF
- Analytics data (yield trend, throughput, IPQC pass rate, deviations)
"""
from io import BytesIO
from datetime import datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, extract, case

from ..database import get_db
from ..dependencies import get_current_user
from ..models.user import User
from ..models.ebr import EBR, EBRStatus, EBRStepStatus, EBRParameterResult, EBRIPQCResult
from ..models.quality import Deviation, DeviationStatus, DeviationSeverity
from ..models.esignature import ESignature

# ReportLab
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.enums import TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether,
)

router = APIRouter(prefix="/reports", tags=["Reports"])

APP_NAME = "PharmaBatch EBR System"
SYSTEM_REF = "21 CFR Part 11 Compliant"

# Colours
PRIMARY   = colors.HexColor("#1677ff")
DARK      = colors.HexColor("#1f2937")
LIGHT     = colors.HexColor("#f8fafc")
BORDER    = colors.HexColor("#e2e8f0")
C_RED     = colors.HexColor("#ef4444")
C_GREEN   = colors.HexColor("#22c55e")
GREEN_BG  = colors.HexColor("#f0fdf4")
SLATE     = colors.HexColor("#64748b")


# ── Helpers ────────────────────────────────────────────────────────────────────

def _fmt_dt(dt) -> str:
    return dt.strftime("%Y-%m-%d %H:%M UTC") if dt else "—"


def _fmt_date(d) -> str:
    return d.strftime("%Y-%m-%d") if d else "—"


def _styles():
    base = getSampleStyleSheet()
    add = base.add

    add(ParagraphStyle("DocTitle",    parent=base["Normal"], fontSize=18,
                       fontName="Helvetica-Bold", textColor=DARK,
                       alignment=TA_CENTER, spaceAfter=4))
    add(ParagraphStyle("DocSubtitle", parent=base["Normal"], fontSize=10,
                       textColor=SLATE, alignment=TA_CENTER, spaceAfter=2))
    add(ParagraphStyle("SectionHdr",  parent=base["Normal"], fontSize=11,
                       fontName="Helvetica-Bold", textColor=PRIMARY,
                       spaceBefore=12, spaceAfter=5))
    add(ParagraphStyle("Small",       parent=base["Normal"], fontSize=8,
                       textColor=colors.HexColor("#475569")))
    add(ParagraphStyle("CertTitle",   parent=base["Normal"], fontSize=22,
                       fontName="Helvetica-Bold", textColor=DARK,
                       alignment=TA_CENTER, spaceAfter=6))
    add(ParagraphStyle("CertBody",    parent=base["Normal"], fontSize=11,
                       textColor=DARK, alignment=TA_CENTER, spaceAfter=8))
    add(ParagraphStyle("Footer",      parent=base["Normal"], fontSize=7,
                       textColor=colors.HexColor("#94a3b8"), alignment=TA_CENTER))
    return base


def _tbl_style(header_bg=None):
    bg = header_bg or PRIMARY
    return TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0),  bg),
        ("TEXTCOLOR",     (0, 0), (-1, 0),  colors.white),
        ("FONTNAME",      (0, 0), (-1, 0),  "Helvetica-Bold"),
        ("FONTSIZE",      (0, 0), (-1, 0),  8),
        ("TOPPADDING",    (0, 0), (-1, 0),  6),
        ("BOTTOMPADDING", (0, 0), (-1, 0),  6),
        ("FONTNAME",      (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE",      (0, 1), (-1, -1), 8),
        ("TOPPADDING",    (0, 1), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 4),
        ("ROWBACKGROUNDS",(0, 1), (-1, -1), [colors.white, LIGHT]),
        ("GRID",          (0, 0), (-1, -1), 0.5, BORDER),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
    ])


def _page_deco(canvas, doc, ebr, subtitle):
    """Reusable header + footer drawn on every page."""
    canvas.saveState()
    w, h = A4

    # Header bar
    canvas.setFillColor(PRIMARY)
    canvas.rect(0, h - 28 * mm, w, 28 * mm, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 12)
    canvas.drawString(15 * mm, h - 14 * mm, APP_NAME)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(15 * mm, h - 21 * mm, SYSTEM_REF)
    canvas.setFont("Helvetica-Bold", 10)
    canvas.drawRightString(w - 15 * mm, h - 14 * mm, subtitle)
    canvas.setFont("Helvetica", 8)
    canvas.drawRightString(w - 15 * mm, h - 21 * mm,
                           f"Batch: {ebr.batch_number}  |  EBR: {ebr.ebr_number}")

    # Footer bar
    canvas.setFillColor(colors.HexColor("#f1f5f9"))
    canvas.rect(0, 0, w, 18 * mm, fill=1, stroke=0)
    canvas.setFillColor(SLATE)
    canvas.setFont("Helvetica", 7)
    canvas.drawString(15 * mm, 10 * mm,
                      f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}  "
                      f"|  CONFIDENTIAL — FOR INTERNAL USE ONLY")
    canvas.drawRightString(w - 15 * mm, 10 * mm, f"Page {doc.page}")
    canvas.restoreState()


# ── EBR Batch Record PDF ───────────────────────────────────────────────────────

def _build_ebr_pdf(ebr: EBR, signatures: list) -> BytesIO:
    buf = BytesIO()
    s = _styles()

    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=15 * mm, rightMargin=15 * mm,
        topMargin=35 * mm, bottomMargin=22 * mm,
        title=f"Batch Record {ebr.batch_number}",
        author=APP_NAME,
    )

    story = []

    def section(title):
        story.append(HRFlowable(width="100%", thickness=1.5, color=PRIMARY))
        story.append(Paragraph(title, s["SectionHdr"]))

    # ── Cover ────────────────────────────────────────────────────────────────
    story.append(Spacer(1, 5 * mm))
    story.append(Paragraph("ELECTRONIC BATCH RECORD", s["DocTitle"]))
    story.append(Paragraph(
        f"Batch: <b>{ebr.batch_number}</b>  ·  EBR No: <b>{ebr.ebr_number}</b>",
        s["DocSubtitle"]))
    story.append(Spacer(1, 3 * mm))

    col = doc.width / 4
    ov = [
        ["PRODUCT NAME",      ebr.product_name,
         "PRODUCT CODE",      ebr.product_code],
        ["STRENGTH",          ebr.strength or "—",
         "DOSAGE FORM",       ebr.dosage_form or "—"],
        ["MBR REFERENCE",     f"{ebr.mbr_number} v{ebr.mbr_version}",
         "STATUS",            ebr.status.value.replace("_", " ")],
        ["PLANNED BATCH SIZE",
         f"{ebr.planned_batch_size or '—'} {ebr.batch_unit or ''}",
         "ACTUAL YIELD",
         (f"{ebr.actual_yield} {ebr.actual_yield_unit or ''}"
          + (f" ({ebr.yield_percentage:.1f}%)" if ebr.yield_percentage else ""))
         if ebr.actual_yield else "—"],
        ["INITIATED BY",      ebr.initiated_by.full_name if ebr.initiated_by else "—",
         "STARTED",           _fmt_dt(ebr.started_at)],
        ["COMPLETED",         _fmt_dt(ebr.completed_at),
         "APPROVED BY",       ebr.approved_by.full_name if ebr.approved_by else "—"],
    ]
    ov_tbl = Table(ov, colWidths=[col * 0.9, col * 1.1, col * 0.9, col * 1.1])
    ov_tbl.setStyle(TableStyle([
        ("FONTNAME",      (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE",      (0, 0), (-1, -1), 8),
        ("FONTNAME",      (0, 0), (0, -1),  "Helvetica-Bold"),
        ("FONTNAME",      (2, 0), (2, -1),  "Helvetica-Bold"),
        ("TEXTCOLOR",     (0, 0), (0, -1),  SLATE),
        ("TEXTCOLOR",     (2, 0), (2, -1),  SLATE),
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING",   (0, 0), (-1, -1), 8),
        ("BACKGROUND",    (0, 0), (-1, -1), LIGHT),
        ("GRID",          (0, 0), (-1, -1), 0.5, BORDER),
    ]))
    story.append(ov_tbl)
    if ebr.notes:
        story.append(Spacer(1, 2 * mm))
        story.append(Paragraph(f"<b>Notes:</b> {ebr.notes}", s["Small"]))

    # ── Section 1: Materials ─────────────────────────────────────────────────
    section("1.  Material Dispensing")
    mat_rows = [["Material Name", "Code", "Req. Qty", "Actual Qty",
                 "Lot #", "Expiry", "Dispensed By", "Date"]]
    for m in ebr.materials:
        mat_rows.append([
            Paragraph(m.material_name + (" ★" if m.is_active_ingredient else ""), s["Small"]),
            m.material_code or "—",
            f"{m.required_quantity} {m.unit}",
            f"{m.actual_quantity} {m.unit}" if m.actual_quantity is not None else "—",
            m.lot_number or "—",
            _fmt_date(m.expiry_date),
            m.dispensed_by.full_name if m.dispensed_by else "—",
            _fmt_dt(m.dispensed_at) if m.dispensed_at else "—",
        ])
    if len(mat_rows) == 1:
        mat_rows.append(["No materials recorded", "", "", "", "", "", "", ""])

    mat_tbl = Table(mat_rows, colWidths=[None, 28*mm, 22*mm, 22*mm, 28*mm, 20*mm, 28*mm, 32*mm])
    mat_tbl.setStyle(_tbl_style())
    story.append(mat_tbl)
    story.append(Paragraph("★ Active Pharmaceutical Ingredient", s["Small"]))

    # ── Section 2: Steps ─────────────────────────────────────────────────────
    section("2.  Manufacturing Steps")

    for step in ebr.steps:
        step_bg = GREEN_BG if step.status == EBRStepStatus.COMPLETED else (
            colors.HexColor("#eff6ff") if step.status == EBRStepStatus.IN_PROGRESS else LIGHT)

        hdr_tbl = Table([[
            Paragraph(f"<b>Step {step.step_number}: {step.title}</b>"
                      + (" · <font color='#ef4444'>CRITICAL</font>" if step.is_critical else ""),
                      s["Small"]),
            Paragraph(f"Status: <b>{step.status.value.replace('_', ' ')}</b>", s["Small"]),
            Paragraph(f"Started: {_fmt_dt(step.started_at)}", s["Small"]),
            Paragraph(f"Completed: {_fmt_dt(step.completed_at)}", s["Small"]),
            Paragraph(f"Operator: {step.operator.full_name if step.operator else '—'}", s["Small"]),
        ]], colWidths=[None, 42*mm, 42*mm, 42*mm, 40*mm])
        hdr_tbl.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, -1), step_bg),
            ("TOPPADDING",    (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING",   (0, 0), (-1, -1), 8),
            ("GRID",          (0, 0), (-1, -1), 0.5, BORDER),
        ]))

        items = [hdr_tbl]
        if step.description:
            items.append(Paragraph(f"<i>{step.description}</i>", s["Small"]))

        # Parameters
        if step.parameter_results:
            p_rows = [["Parameter", "Unit", "Target", "Range", "Actual", "Pass/Fail", "By"]]
            for p in step.parameter_results:
                pf_color = C_GREEN if p.is_in_range is True else (
                    C_RED if p.is_in_range is False else colors.HexColor("#94a3b8"))
                p_rows.append([
                    Paragraph(p.parameter_name + (" ⚠" if p.is_critical else ""), s["Small"]),
                    p.unit or "—",
                    p.target_value or "—",
                    f"{p.min_value or '—'} – {p.max_value or '—'}",
                    p.actual_value or "—",
                    Paragraph(
                        "<b>" + ("PASS" if p.is_in_range is True
                                 else "FAIL" if p.is_in_range is False else "N/A") + "</b>",
                        ParagraphStyle("pf", parent=_styles()["Small"], textColor=pf_color)),
                    p.recorded_by.full_name if p.recorded_by else "—",
                ])
            p_tbl = Table(p_rows, colWidths=[None, 16*mm, 22*mm, 32*mm, 26*mm, 18*mm, 30*mm])
            p_tbl.setStyle(_tbl_style(colors.HexColor("#374151")))
            items += [Spacer(1, 2), Paragraph("Process Parameters:", s["Small"]), p_tbl]

        # IPQC
        if step.ipqc_results:
            i_rows = [["Test Name", "Method", "Acceptance Criteria", "Actual Result", "Pass/Fail", "By"]]
            for i in step.ipqc_results:
                pf_color = C_GREEN if i.passed is True else (
                    C_RED if i.passed is False else colors.HexColor("#94a3b8"))
                i_rows.append([
                    i.test_name,
                    i.method or "—",
                    Paragraph(i.acceptance_criteria, s["Small"]),
                    i.actual_result or "—",
                    Paragraph(
                        "<b>" + ("PASS" if i.passed is True
                                 else "FAIL" if i.passed is False else "N/A") + "</b>",
                        ParagraphStyle("ipf", parent=_styles()["Small"], textColor=pf_color)),
                    i.performed_by.full_name if i.performed_by else "—",
                ])
            i_tbl = Table(i_rows, colWidths=[None, 28*mm, None, 34*mm, 18*mm, 30*mm])
            i_tbl.setStyle(_tbl_style(colors.HexColor("#4f46e5")))
            items += [Spacer(1, 2), Paragraph("In-Process QC (IPQC):", s["Small"]), i_tbl]

        if step.execution_notes:
            items.append(Paragraph(f"<b>Execution Notes:</b> {step.execution_notes}", s["Small"]))

        story.append(KeepTogether(items))
        story.append(Spacer(1, 3 * mm))

    # ── Section 3: E-Signatures ──────────────────────────────────────────────
    section("3.  Electronic Signatures  (21 CFR Part 11 §11.50)")
    if signatures:
        sig_rows = [["Sig #", "Signer", "Username", "Action", "Meaning", "Date / Time (UTC)", "IP"]]
        for sig in signatures:
            sig_rows.append([
                sig.signature_number,
                sig.signer_full_name,
                sig.signer_username,
                sig.action.upper(),
                Paragraph(sig.meaning, s["Small"]),
                _fmt_dt(sig.signed_at),
                sig.ip_address or "—",
            ])
        sig_tbl = Table(sig_rows,
                        colWidths=[28*mm, 36*mm, 28*mm, 20*mm, None, 38*mm, 20*mm])
        sig_tbl.setStyle(_tbl_style(colors.HexColor("#7c3aed")))
        story.append(sig_tbl)
    else:
        story.append(Paragraph("No electronic signatures recorded.", s["Small"]))

    # Disclaimer
    story.append(Spacer(1, 6 * mm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER))
    story.append(Spacer(1, 2 * mm))
    story.append(Paragraph(
        "This Electronic Batch Record is generated by a 21 CFR Part 11 compliant system. "
        "All entries are time-stamped, attributed to the responsible individual, and maintained "
        "in an immutable audit trail. Unauthorised alteration of this document is prohibited.",
        ParagraphStyle("Disc", parent=s["Footer"], alignment=TA_CENTER)))

    doc.build(
        story,
        onFirstPage=lambda c, d: _page_deco(c, d, ebr, "BATCH RECORD"),
        onLaterPages=lambda c, d: _page_deco(c, d, ebr, "BATCH RECORD"),
    )
    buf.seek(0)
    return buf


# ── Batch Release Certificate PDF ─────────────────────────────────────────────

def _build_certificate_pdf(ebr: EBR, signatures: list) -> BytesIO:
    buf = BytesIO()
    s = _styles()

    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=20 * mm, rightMargin=20 * mm,
        topMargin=20 * mm, bottomMargin=20 * mm,
        title=f"Batch Release Certificate {ebr.batch_number}",
    )
    w = doc.width
    story = []

    story.append(Spacer(1, 8 * mm))
    story.append(Paragraph(APP_NAME,
                            ParagraphStyle("AppH", parent=s["DocSubtitle"],
                                           fontSize=11, fontName="Helvetica-Bold")))
    story.append(Spacer(1, 2 * mm))
    story.append(HRFlowable(width="100%", thickness=2, color=PRIMARY))
    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph("BATCH RELEASE CERTIFICATE", s["CertTitle"]))
    story.append(Paragraph(SYSTEM_REF, s["DocSubtitle"]))
    story.append(Spacer(1, 6 * mm))
    story.append(HRFlowable(width="60%", thickness=1, color=BORDER))
    story.append(Spacer(1, 6 * mm))

    cert_data = [
        ["Product Name",              ebr.product_name],
        ["Product Code",              ebr.product_code],
        ["Strength / Dosage Form",    f"{ebr.strength or '—'}  /  {ebr.dosage_form or '—'}"],
        ["Batch Number",              ebr.batch_number],
        ["EBR Reference",             ebr.ebr_number],
        ["MBR Reference",             f"{ebr.mbr_number}  Rev.{ebr.mbr_version}"],
        ["Planned Batch Size",        f"{ebr.planned_batch_size or '—'} {ebr.batch_unit or ''}"],
        ["Actual Yield",              f"{ebr.actual_yield or '—'} {ebr.actual_yield_unit or ''}"],
        ["Yield %",
         f"{ebr.yield_percentage:.2f} %" if ebr.yield_percentage else "—"],
        ["Manufacturing Date",        _fmt_dt(ebr.started_at)],
        ["Completion Date",           _fmt_dt(ebr.completed_at)],
        ["Release Date",              _fmt_dt(ebr.approved_at)],
        ["Released By",               ebr.approved_by.full_name if ebr.approved_by else "—"],
    ]

    cert_tbl = Table(cert_data, colWidths=[w * 0.38, w * 0.62])
    cert_tbl.setStyle(TableStyle([
        ("FONTNAME",      (0, 0), (0, -1),  "Helvetica-Bold"),
        ("FONTSIZE",      (0, 0), (-1, -1), 10),
        ("TEXTCOLOR",     (0, 0), (0, -1),  SLATE),
        ("TOPPADDING",    (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING",   (0, 0), (-1, -1), 10),
        ("ROWBACKGROUNDS",(0, 0), (-1, -1), [colors.white, LIGHT]),
        ("GRID",          (0, 0), (-1, -1), 0.5, BORDER),
        ("TEXTCOLOR",     (1, 8), (1, 8),
         C_GREEN if (ebr.yield_percentage or 0) >= 98
         else colors.HexColor("#f97316")),
        ("FONTNAME",      (1, 8), (1, 8),   "Helvetica-Bold"),
    ]))
    story.append(cert_tbl)
    story.append(Spacer(1, 8 * mm))

    story.append(HRFlowable(width="100%", thickness=1, color=BORDER))
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph(
        "This is to certify that the above batch has been manufactured, tested, and reviewed "
        "in accordance with the approved Master Batch Record and all applicable current Good "
        "Manufacturing Practices (cGMP). All in-process quality control checks were performed "
        "and recorded. The batch is hereby <b>RELEASED FOR DISTRIBUTION</b>.",
        s["CertBody"]))
    story.append(Spacer(1, 6 * mm))

    if signatures:
        story.append(Paragraph("Electronic Signatures",
                               ParagraphStyle("SH", parent=s["SectionHdr"], alignment=TA_CENTER)))
        sig_rows = [["Name", "Action", "Date (UTC)", "Signature #"]]
        for sig in signatures:
            sig_rows.append([
                sig.signer_full_name,
                sig.action.capitalize(),
                _fmt_dt(sig.signed_at),
                sig.signature_number,
            ])
        sig_tbl = Table(sig_rows,
                        colWidths=[w * 0.3, w * 0.18, w * 0.32, w * 0.2])
        sig_tbl.setStyle(_tbl_style(colors.HexColor("#7c3aed")))
        story.append(sig_tbl)

    story.append(Spacer(1, 8 * mm))
    story.append(HRFlowable(width="100%", thickness=2, color=PRIMARY))
    story.append(Spacer(1, 3 * mm))
    story.append(Paragraph(
        f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}  "
        f"|  {APP_NAME}  |  {SYSTEM_REF}",
        s["Footer"]))
    story.append(Paragraph(
        "CONFIDENTIAL — FOR AUTHORISED PERSONNEL ONLY",
        ParagraphStyle("Conf", parent=s["Footer"], fontName="Helvetica-Bold")))

    doc.build(story)
    buf.seek(0)
    return buf


# ── API Endpoints ──────────────────────────────────────────────────────────────

@router.get("/dashboard")
def dashboard_stats(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    active = db.query(func.count(EBR.id)).filter(
        EBR.status.in_([EBRStatus.INITIATED, EBRStatus.IN_PROGRESS])
    ).scalar()

    pending_review = db.query(func.count(EBR.id)).filter(
        EBR.status == EBRStatus.UNDER_REVIEW
    ).scalar()

    released_this_month = db.query(func.count(EBR.id)).filter(
        EBR.status == EBRStatus.APPROVED,
        EBR.approved_at >= month_start,
    ).scalar()

    open_deviations = db.query(func.count(Deviation.id)).filter(
        Deviation.status.in_([
            DeviationStatus.OPEN,
            DeviationStatus.UNDER_INVESTIGATION,
            DeviationStatus.PENDING_CAPA,
        ])
    ).scalar()

    recent = db.query(EBR).order_by(EBR.updated_at.desc()).limit(5).all()

    return {
        "active_batches": active,
        "pending_review": pending_review,
        "released_this_month": released_this_month,
        "open_deviations": open_deviations,
        "recent_batches": [
            {
                "id": str(r.id),
                "ebr_number": r.ebr_number,
                "batch_number": r.batch_number,
                "product_name": r.product_name,
                "status": r.status.value,
                "updated_at": r.updated_at.isoformat() if r.updated_at else None,
            }
            for r in recent
        ],
    }


@router.get("/ebr/{ebr_id}/pdf")
def download_ebr_pdf(
    ebr_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    ebr = db.query(EBR).filter(EBR.id == ebr_id).first()
    if not ebr:
        raise HTTPException(status_code=404, detail="EBR not found")

    sigs = (db.query(ESignature)
            .filter(ESignature.resource_type == "ebr",
                    ESignature.resource_id == str(ebr_id))
            .order_by(ESignature.signed_at.asc()).all())

    buf = _build_ebr_pdf(ebr, sigs)
    filename = f"EBR_{ebr.batch_number}_{ebr.ebr_number}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/ebr/{ebr_id}/certificate")
def download_batch_certificate(
    ebr_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    ebr = db.query(EBR).filter(EBR.id == ebr_id).first()
    if not ebr:
        raise HTTPException(status_code=404, detail="EBR not found")
    if ebr.status != EBRStatus.APPROVED:
        raise HTTPException(
            status_code=400,
            detail="Batch release certificate is only available for APPROVED (released) batches",
        )

    sigs = (db.query(ESignature)
            .filter(ESignature.resource_type == "ebr",
                    ESignature.resource_id == str(ebr_id))
            .order_by(ESignature.signed_at.asc()).all())

    buf = _build_certificate_pdf(ebr, sigs)
    filename = f"Certificate_{ebr.batch_number}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── Analytics Endpoint ────────────────────────────────────────────────────────

@router.get("/analytics")
def analytics(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    now = datetime.utcnow()

    # ── Yield trend: last 20 completed/approved batches ──────────────────────
    yield_rows = (
        db.query(EBR)
        .filter(
            EBR.yield_percentage.isnot(None),
            EBR.status.in_([EBRStatus.COMPLETED, EBRStatus.UNDER_REVIEW,
                             EBRStatus.APPROVED, EBRStatus.REJECTED]),
        )
        .order_by(EBR.completed_at.desc())
        .limit(20)
        .all()
    )
    yield_trend = [
        {
            "batch_number": r.batch_number,
            "product_name": r.product_name,
            "yield_percentage": round(r.yield_percentage, 2),
            "completed_at": r.completed_at.strftime("%Y-%m-%d") if r.completed_at else None,
            "status": r.status.value,
        }
        for r in reversed(yield_rows)
    ]

    # ── Status breakdown: count of all EBRs per status ──────────────────────
    status_rows = (
        db.query(EBR.status, func.count(EBR.id))
        .group_by(EBR.status)
        .all()
    )
    status_labels = {
        "INITIATED": "Initiated",
        "IN_PROGRESS": "In Progress",
        "COMPLETED": "Completed",
        "UNDER_REVIEW": "Under Review",
        "APPROVED": "Released",
        "REJECTED": "Rejected",
    }
    status_breakdown = [
        {"status": s.value, "label": status_labels.get(s.value, s.value), "count": cnt}
        for s, cnt in status_rows
    ]

    # ── Monthly throughput: last 6 months ────────────────────────────────────
    six_months_ago = now - timedelta(days=180)
    monthly_rows = (
        db.query(
            extract("year",  EBR.created_at).label("yr"),
            extract("month", EBR.created_at).label("mo"),
            func.count(EBR.id).label("initiated"),
            func.count(case((EBR.status == EBRStatus.APPROVED, EBR.id))).label("released"),
        )
        .filter(EBR.created_at >= six_months_ago)
        .group_by("yr", "mo")
        .order_by("yr", "mo")
        .all()
    )
    monthly_throughput = [
        {
            "month": f"{int(r.yr)}-{int(r.mo):02d}",
            "initiated": r.initiated,
            "released": r.released,
        }
        for r in monthly_rows
    ]

    # ── IPQC pass rate ───────────────────────────────────────────────────────
    ipqc_total   = db.query(func.count(EBRIPQCResult.id)).scalar() or 0
    ipqc_passed  = db.query(func.count(EBRIPQCResult.id)).filter(EBRIPQCResult.passed.is_(True)).scalar() or 0
    ipqc_failed  = db.query(func.count(EBRIPQCResult.id)).filter(EBRIPQCResult.passed.is_(False)).scalar() or 0
    ipqc_pending = ipqc_total - ipqc_passed - ipqc_failed

    # ── Out-of-range parameters ──────────────────────────────────────────────
    param_total     = db.query(func.count(EBRParameterResult.id)).scalar() or 0
    param_in_range  = db.query(func.count(EBRParameterResult.id)).filter(EBRParameterResult.is_in_range.is_(True)).scalar() or 0
    param_out_range = db.query(func.count(EBRParameterResult.id)).filter(EBRParameterResult.is_in_range.is_(False)).scalar() or 0

    # ── Deviation breakdown by severity ─────────────────────────────────────
    dev_rows = (
        db.query(Deviation.severity, Deviation.status, func.count(Deviation.id))
        .group_by(Deviation.severity, Deviation.status)
        .all()
    )
    dev_by_severity: dict = {}
    for sev, st, cnt in dev_rows:
        key = sev.value
        if key not in dev_by_severity:
            dev_by_severity[key] = {"severity": key, "open": 0, "closed": 0, "total": 0}
        dev_by_severity[key]["total"] += cnt
        if st == DeviationStatus.CLOSED:
            dev_by_severity[key]["closed"] += cnt
        else:
            dev_by_severity[key]["open"] += cnt

    # ── Top 5 products by batch count ────────────────────────────────────────
    top_products_rows = (
        db.query(EBR.product_name, func.count(EBR.id).label("cnt"))
        .group_by(EBR.product_name)
        .order_by(func.count(EBR.id).desc())
        .limit(5)
        .all()
    )
    top_products = [{"product": name, "batches": cnt} for name, cnt in top_products_rows]

    return {
        "yield_trend": yield_trend,
        "status_breakdown": status_breakdown,
        "monthly_throughput": monthly_throughput,
        "ipqc": {
            "total": ipqc_total,
            "passed": ipqc_passed,
            "failed": ipqc_failed,
            "pending": ipqc_pending,
            "pass_rate": round(ipqc_passed / ipqc_total * 100, 1) if ipqc_total else None,
        },
        "parameters": {
            "total": param_total,
            "in_range": param_in_range,
            "out_of_range": param_out_range,
            "pass_rate": round(param_in_range / (param_in_range + param_out_range) * 100, 1)
                         if (param_in_range + param_out_range) else None,
        },
        "deviations_by_severity": list(dev_by_severity.values()),
        "top_products": top_products,
    }
