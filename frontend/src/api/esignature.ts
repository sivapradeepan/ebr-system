import api from './client';
import type { ESignature, ESignatureList } from '../types/esignature';

export const esignatureApi = {
  sign: (data: {
    resource_type: string;
    resource_id: string;
    action: string;
    meaning: string;
    comments?: string;
    password: string;
  }): Promise<ESignature> =>
    api.post('/esignatures/sign', data).then(r => r.data),

  list: (params: { resource_type?: string; resource_id?: string }): Promise<ESignatureList> =>
    api.get('/esignatures', { params }).then(r => r.data),
};
