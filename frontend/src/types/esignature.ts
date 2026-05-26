export interface ESignature {
  id: string;
  signature_number: string;
  signer_full_name: string;
  signer_username: string;
  resource_type: string;
  resource_id: string;
  resource_identifier: string;
  action: string;
  meaning: string;
  comments?: string;
  signed_at: string;
  ip_address?: string;
  password_verified: boolean;
}

export interface ESignatureList {
  items: ESignature[];
  total: number;
}
