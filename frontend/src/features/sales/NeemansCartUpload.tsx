import { UploadLog } from './UploadLog';

export default function NeemansCartUpload() {
  return <UploadLog endpoint="/sales/upload-neemans-cart" table="neemans_cart" title="Neemans Cart Upload" />;
}
