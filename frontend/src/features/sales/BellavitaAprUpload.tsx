import { UploadLog } from './UploadLog';

export default function BellavitaAprUpload() {
  return <UploadLog endpoint="/sales/upload-bellavita-apr" table="bb_apr" title="Bellavita APR Upload" />;
}
