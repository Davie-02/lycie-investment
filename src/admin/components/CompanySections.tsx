import { useState, type FormEvent, type ReactNode } from "react";
import FormField from "@/components/forms/FormField";
import FormStatusBanner from "@/components/forms/FormStatusBanner";
import { adminApi } from "../adminApi";
import { ApiError } from "@/services/http";
import { useAdminAuth } from "../context/AdminAuthContext";
import ImageUploader from "./ImageUploader";
import type { ClientsContent, CompanyContent, FleetContent, SiteContent, TeamContent } from "@/types/siteContent";

/** Saves one section under /site-content/<key> and reports the outcome the same way for every editor. */
function useSectionSave<T>(key: keyof SiteContent, values: T, onSaved: () => void) {
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function save(event: FormEvent) {
    event.preventDefault();
    setStatus("saving");
    setError(null);
    try {
      await adminApi.patch(`/site-content/${key}`, { value: values });
      setStatus("success");
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save.");
      setStatus("error");
    }
  }
  return { status, error, save };
}

function Shell(props: { id: string; title: string; hint: string; status: string; error: string | null; onSubmit: (e: FormEvent) => void; children: ReactNode; saveLabel: string }) {
  return (
    <form id={props.id} className="form-card" onSubmit={props.onSubmit} noValidate>
      <h2>{props.title}</h2>
      <p className="text-muted">{props.hint}</p>
      {props.status === "success" && <FormStatusBanner status="success" successMessage="Saved — it's live on the site." errorMessage={null} />}
      {props.status === "error" && <FormStatusBanner status="error" successMessage="" errorMessage={props.error} />}
      {props.children}
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={props.status === "saving"}>
          {props.status === "saving" ? "Saving…" : props.saveLabel}
        </button>
      </div>
    </form>
  );
}

const move = <T,>(list: T[], from: number, to: number): T[] => {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

function RowTools({ index, count, onMove, onRemove }: { index: number; count: number; onMove: (to: number) => void; onRemove: () => void }) {
  return (
    <div className="admin-table__actions">
      <button type="button" className="btn-ghost" disabled={index === 0} onClick={() => onMove(index - 1)} aria-label="Move up">↑</button>
      <button type="button" className="btn-ghost" disabled={index === count - 1} onClick={() => onMove(index + 1)} aria-label="Move down">↓</button>
      <button type="button" className="btn-ghost" onClick={onRemove}>Remove</button>
    </div>
  );
}

const lines = (text: string) => text.split("\n").map((l) => l.trim()).filter(Boolean);

// ------------------------------------------------------------------ company

export function CompanySection({ initial, onSaved }: { initial: CompanyContent; onSaved: () => void }) {
  const [v, setV] = useState<CompanyContent>(initial);
  const [storyText, setStoryText] = useState(initial.story.join("\n\n"));
  const [pointsText, setPointsText] = useState(initial.missionPoints.join("\n"));
  const merged: CompanyContent = {
    ...v,
    story: storyText.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean),
    missionPoints: lines(pointsText),
  };
  const { status, error, save } = useSectionSave("company", merged, onSaved);

  return (
    <Shell id="site-content-company" title="Company story, vision & mission" hint="Shown on the About page, and the “Since …” figures on the homepage. Leave blank to hide." status={status} error={error} onSubmit={save} saveLabel="Save company story">
      <div className="form-grid form-grid--2col">
        <FormField id="company-name" label="Registered name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        <FormField id="company-established" label="Year established" type="number" value={v.established ?? ""} onChange={(e) => setV({ ...v, established: e.target.value ? Number(e.target.value) : null })} />
        <FormField id="company-tagline" label="About page headline" value={v.tagline} onChange={(e) => setV({ ...v, tagline: e.target.value })} wrapperClassName="form-grid__full" />
        <FormField id="company-story" as="textarea" rows={6} label="Our story (separate paragraphs with a blank line)" value={storyText} onChange={(e) => setStoryText(e.target.value)} wrapperClassName="form-grid__full" />
        <FormField id="company-vision" as="textarea" rows={3} label="Vision" value={v.vision} onChange={(e) => setV({ ...v, vision: e.target.value })} wrapperClassName="form-grid__full" />
        <FormField id="company-mission" label="Mission (short lead-in)" value={v.mission} onChange={(e) => setV({ ...v, mission: e.target.value })} wrapperClassName="form-grid__full" />
        <FormField id="company-points" as="textarea" rows={5} label="Mission points (one per line)" value={pointsText} onChange={(e) => setPointsText(e.target.value)} wrapperClassName="form-grid__full" />
      </div>

      <h3 className="cs-subtitle">Values</h3>
      {v.values.map((value, i) => (
        <fieldset className="site-content-fieldset" key={i}>
          <legend>Value {i + 1}</legend>
          <div className="form-grid form-grid--2col">
            <FormField id={`company-value-${i}-t`} label="Title" value={value.title} onChange={(e) => setV({ ...v, values: v.values.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} />
            <FormField id={`company-value-${i}-d`} label="Detail" value={value.detail} onChange={(e) => setV({ ...v, values: v.values.map((x, j) => (j === i ? { ...x, detail: e.target.value } : x)) })} />
          </div>
          <RowTools index={i} count={v.values.length} onMove={(to) => setV({ ...v, values: move(v.values, i, to) })} onRemove={() => setV({ ...v, values: v.values.filter((_, j) => j !== i) })} />
        </fieldset>
      ))}
      <button type="button" className="btn btn-secondary" onClick={() => setV({ ...v, values: [...v.values, { title: "", detail: "" }] })}>Add a value</button>
    </Shell>
  );
}

// ------------------------------------------------------------------ team

export function TeamSectionEditor({ initial, onSaved }: { initial: TeamContent; onSaved: () => void }) {
  const [v, setV] = useState<TeamContent>(initial);
  const { status, error, save } = useSectionSave("team", v, onSaved);
  const setGroup = (gi: number, patch: Partial<TeamContent["groups"][number]>) =>
    setV({ ...v, groups: v.groups.map((g, i) => (i === gi ? { ...g, ...patch } : g)) });

  return (
    <Shell id="site-content-team" title="Team" hint="People shown on the About page, grouped (leadership, management, drivers…). A photo is optional — initials are shown without one." status={status} error={error} onSubmit={save} saveLabel="Save team">
      <div className="form-grid form-grid--2col">
        <FormField id="team-eyebrow" label="Eyebrow" value={v.eyebrow} onChange={(e) => setV({ ...v, eyebrow: e.target.value })} />
        <FormField id="team-heading" label="Heading" value={v.heading} onChange={(e) => setV({ ...v, heading: e.target.value })} />
        <FormField id="team-body" as="textarea" rows={2} label="Intro" value={v.body} onChange={(e) => setV({ ...v, body: e.target.value })} wrapperClassName="form-grid__full" />
      </div>

      {v.groups.map((group, gi) => (
        <fieldset className="site-content-fieldset" key={gi}>
          <legend>Group {gi + 1}</legend>
          <FormField id={`team-group-${gi}`} label="Group name" value={group.title} onChange={(e) => setGroup(gi, { title: e.target.value })} />
          {group.members.map((member, mi) => (
            <div className="cs-row" key={mi}>
              <div className="form-grid form-grid--2col">
                <FormField id={`team-${gi}-${mi}-n`} label="Name" value={member.name} onChange={(e) => setGroup(gi, { members: group.members.map((m, k) => (k === mi ? { ...m, name: e.target.value } : m)) })} />
                <FormField id={`team-${gi}-${mi}-r`} label="Role" value={member.role} onChange={(e) => setGroup(gi, { members: group.members.map((m, k) => (k === mi ? { ...m, role: e.target.value } : m)) })} />
              </div>
              <div className="form-field">
                <label>Photo (optional)</label>
                <ImageUploader multiple={false} images={member.photoUrl ? [member.photoUrl] : []} onChange={(imgs) => setGroup(gi, { members: group.members.map((m, k) => (k === mi ? { ...m, photoUrl: imgs[0] } : m)) })} />
              </div>
              <RowTools index={mi} count={group.members.length} onMove={(to) => setGroup(gi, { members: move(group.members, mi, to) })} onRemove={() => setGroup(gi, { members: group.members.filter((_, k) => k !== mi) })} />
            </div>
          ))}
          <div className="admin-table__actions">
            <button type="button" className="btn btn-secondary" onClick={() => setGroup(gi, { members: [...group.members, { name: "", role: "" }] })}>Add a person</button>
            <button type="button" className="btn-ghost" disabled={gi === 0} onClick={() => setV({ ...v, groups: move(v.groups, gi, gi - 1) })}>Move group up</button>
            <button type="button" className="btn-ghost" disabled={gi === v.groups.length - 1} onClick={() => setV({ ...v, groups: move(v.groups, gi, gi + 1) })}>Move group down</button>
            <button type="button" className="btn-ghost" onClick={() => setV({ ...v, groups: v.groups.filter((_, i) => i !== gi) })}>Remove group</button>
          </div>
        </fieldset>
      ))}
      <button type="button" className="btn btn-secondary" onClick={() => setV({ ...v, groups: [...v.groups, { title: "", members: [{ name: "", role: "" }] }] })}>Add a group</button>
    </Shell>
  );
}

// ------------------------------------------------------------------ clients

export function ClientsSectionEditor({ initial, onSaved }: { initial: ClientsContent; onSaved: () => void }) {
  const [v, setV] = useState<ClientsContent>(initial);
  const { status, error, save } = useSectionSave("clients", v, onSaved);

  return (
    <Shell id="site-content-clients" title="Clients (who we serve)" hint="Sectors or clients shown on the homepage and About page. Only publish names you have permission to show." status={status} error={error} onSubmit={save} saveLabel="Save clients">
      <div className="form-grid form-grid--2col">
        <FormField id="clients-eyebrow" label="Eyebrow" value={v.eyebrow} onChange={(e) => setV({ ...v, eyebrow: e.target.value })} />
        <FormField id="clients-heading" label="Heading" value={v.heading} onChange={(e) => setV({ ...v, heading: e.target.value })} />
        <FormField id="clients-body" as="textarea" rows={2} label="Intro" value={v.body} onChange={(e) => setV({ ...v, body: e.target.value })} wrapperClassName="form-grid__full" />
      </div>
      {v.items.map((item, i) => (
        <fieldset className="site-content-fieldset" key={i}>
          <legend>Client group {i + 1}</legend>
          <FormField id={`clients-${i}-t`} label="Title" value={item.title} onChange={(e) => setV({ ...v, items: v.items.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} />
          <FormField id={`clients-${i}-d`} as="textarea" rows={3} label="Details" value={item.detail} onChange={(e) => setV({ ...v, items: v.items.map((x, j) => (j === i ? { ...x, detail: e.target.value } : x)) })} />
          <RowTools index={i} count={v.items.length} onMove={(to) => setV({ ...v, items: move(v.items, i, to) })} onRemove={() => setV({ ...v, items: v.items.filter((_, j) => j !== i) })} />
        </fieldset>
      ))}
      <button type="button" className="btn btn-secondary" onClick={() => setV({ ...v, items: [...v.items, { title: "", detail: "" }] })}>Add a client group</button>
    </Shell>
  );
}

// ------------------------------------------------------------------ fleet

export function FleetSectionEditor({ initial, onSaved }: { initial: FleetContent; onSaved: () => void }) {
  const [v, setV] = useState<FleetContent>(initial);
  const { status, error, save } = useSectionSave("fleet", v, onSaved);
  const setItem = (i: number, patch: Partial<FleetContent["items"][number]>) => setV({ ...v, items: v.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) });

  return (
    <Shell id="site-content-fleet" title="Our fleet" hint="Photos of the company's vehicles. Upload a photo for each — the whole picture is shown. Until then a neutral placeholder appears." status={status} error={error} onSubmit={save} saveLabel="Save fleet">
      <div className="form-grid form-grid--2col">
        <FormField id="fleet-eyebrow" label="Eyebrow" value={v.eyebrow} onChange={(e) => setV({ ...v, eyebrow: e.target.value })} />
        <FormField id="fleet-heading" label="Heading" value={v.heading} onChange={(e) => setV({ ...v, heading: e.target.value })} />
        <FormField id="fleet-body" as="textarea" rows={2} label="Intro" value={v.body} onChange={(e) => setV({ ...v, body: e.target.value })} wrapperClassName="form-grid__full" />
      </div>
      {v.items.map((item, i) => (
        <fieldset className="site-content-fieldset" key={i}>
          <legend>Vehicle {i + 1}</legend>
          <div className="form-grid form-grid--2col">
            <FormField id={`fleet-${i}-t`} label="Name" value={item.title} onChange={(e) => setItem(i, { title: e.target.value })} />
            <FormField id={`fleet-${i}-c`} label="Short caption (optional)" value={item.caption} onChange={(e) => setItem(i, { caption: e.target.value })} />
          </div>
          <div className="form-field">
            <label>Photo</label>
            <ImageUploader multiple={false} images={item.image ? [item.image] : []} onChange={(imgs) => setItem(i, { image: imgs[0] })} />
          </div>
          <RowTools index={i} count={v.items.length} onMove={(to) => setV({ ...v, items: move(v.items, i, to) })} onRemove={() => setV({ ...v, items: v.items.filter((_, j) => j !== i) })} />
        </fieldset>
      ))}
      <button type="button" className="btn btn-secondary" onClick={() => setV({ ...v, items: [...v.items, { title: "", caption: "" }] })}>Add a vehicle</button>
    </Shell>
  );
}

// ------------------------------------------------------------------ load profile

/** Owner-only: fills About, Services, Contact, Team, Clients and Fleet from the company profile. */
export function LoadProfileButton({ onDone }: { onDone: () => void }) {
  const { currentUser } = useAdminAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  if (currentUser?.role !== "OWNER") return null;

  async function load() {
    if (!window.confirm("Load the company profile?\n\nThis replaces the About, Services, Contact details, Team, Clients and Fleet text with the company profile. You can edit everything afterwards.")) return;
    setBusy(true);
    setMessage(null);
    try {
      await adminApi.post("/site-content/apply-profile", {});
      setMessage({ ok: true, text: "Company profile loaded — the site now shows it. Scroll down to review or edit each section." });
      onDone();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof ApiError ? err.message : "Couldn't load the profile." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cs-profile">
      <button type="button" className="btn btn-primary" disabled={busy} onClick={load}>
        {busy ? "Loading…" : "Load company profile"}
      </button>
      <span className="text-muted">Fills About, Services, Contact, Team, Clients and Fleet from the company's business profile.</span>
      {message && <p className={message.ok ? "attention__ok" : "admin-error-text"} role="status">{message.text}</p>}
    </div>
  );
}
