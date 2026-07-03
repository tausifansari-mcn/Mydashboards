import { UploadLog } from './UploadLog';

export default function BellavitaCartUpload() {
  return <UploadLog endpoint="/sales/upload-bellavita-cart" table="bb_cart" title="Bellavita Cart Upload" />;
}
