import { UploadLog } from './UploadLog';

export default function BellavitaUpload() {
  return <UploadLog endpoint="/sales/upload-bellavita" table="bb_sale" title="Bellavita Sale Upload" />;
}
