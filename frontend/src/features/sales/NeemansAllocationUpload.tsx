import { UploadLog } from './UploadLog';

export default function NeemansAllocationUpload() {
  return <UploadLog endpoint="/sales/upload-neemans-allocation" table="neemans_allocation" title="Neemans Allocation Upload" />;
}
