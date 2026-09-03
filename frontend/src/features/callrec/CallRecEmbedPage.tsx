// Call Rec UI is a fully separate app (own server, own auth, own DB) but is embedded here via
// iframe so it opens under the same Mydashboards URL/tab instead of a separate browser tab.
// It runs on the same host as this dashboard, just a different port — derived from the current
// page's host rather than hardcoded, so it resolves correctly on localhost, the LAN IP, or a domain.
const CALL_REC_URL = `${window.location.protocol}//${window.location.hostname}:5174`;

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
