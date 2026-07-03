import { UploadLog } from './UploadLog';

export default function GncAllocationUpload() {
  return <UploadLog endpoint="/sales/upload-gnc-allocation" table="gnc_allocation" title="GNC Allocation Upload" />;
}
