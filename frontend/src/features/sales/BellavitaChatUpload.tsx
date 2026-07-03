import { UploadLog } from './UploadLog';

export default function BellavitaChatUpload() {
  return <UploadLog endpoint="/sales/upload-bellavita-chat" table="bb_chat" title="Bellavita Chat Upload" />;
}
