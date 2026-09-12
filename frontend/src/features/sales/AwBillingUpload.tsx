import { UploadLog } from './UploadLog';

export default function AwBillingUpload() {
  return <UploadLog endpoint="/sales/upload-aw-billing" table="aw_billing" title="AW Billing Upload" />;
}
