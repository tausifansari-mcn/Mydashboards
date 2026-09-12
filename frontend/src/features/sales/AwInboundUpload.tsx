import { UploadLog } from './UploadLog';

export default function AwInboundUpload() {
  return <UploadLog endpoint="/sales/upload-aw-inbound" table="aw_inbound" title="AW Inbound Upload" />;
}
