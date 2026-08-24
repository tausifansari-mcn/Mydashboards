// Call Rec UI is a fully separate app (own server, own auth, own DB) but is embedded here via
// iframe so it opens under the same Mydashboards URL/tab instead of a separate browser tab.
const CALL_REC_URL = 'http://localhost:5174';

export default function CallRecEmbedPage() {
  return (
    <div className="h-full w-full">
      <iframe
        src={CALL_REC_URL}
        title="Call Rec UI"
        className="h-full w-full border-0"
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
}
