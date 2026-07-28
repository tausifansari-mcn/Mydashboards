import { UploadLog } from './UploadLog';

export default function BellavitaOrderExportUpload() {
  return <UploadLog endpoint="/sales/upload-bellavita-order-export" table="bvo_order_export" title="OrderExport For Repeat" />;
}
