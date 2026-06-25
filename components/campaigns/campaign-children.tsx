"use client";

import { zodResolver } from "@hookform/resolvers/zod";

import type {
  Character,
  Item,
  Location,
  NPC,
  Session,
} from "@/app/generated/prisma/client";
import { CrudSection } from "@/components/campaigns/crud-section";
import { useEnrichmentCommit } from "@/components/enrichment/use-enrichment-commit";
import { createCharacterSchema } from "@/lib/validation/character";
import { createItemSchema } from "@/lib/validation/item";
import { createLocationSchema } from "@/lib/validation/location";
import { createNpcSchema } from "@/lib/validation/npc";
import { createSessionSchema } from "@/lib/validation/session";
import { api } from "~/trpc/react";

const NONE = "none";

export function CampaignChildren({
  campaignId,
  npcs,
  sessions,
  locations,
  items,
  characters,
}: {
  campaignId: string;
  npcs: NPC[];
  sessions: Session[];
  locations: Location[];
  items: Item[];
  characters: Character[];
}) {
  // Mutation hooks (called unconditionally per the rules of hooks).
  const npcM = {
    create: api.npc.create.useMutation(),
    update: api.npc.update.useMutation(),
    del: api.npc.delete.useMutation(),
  };
  const sessionM = {
    create: api.session.create.useMutation(),
    update: api.session.update.useMutation(),
    del: api.session.delete.useMutation(),
  };
  const locationM = {
    create: api.location.create.useMutation(),
    update: api.location.update.useMutation(),
    del: api.location.delete.useMutation(),
  };
  const itemM = {
    create: api.item.create.useMutation(),
    update: api.item.update.useMutation(),
    del: api.item.delete.useMutation(),
  };
  const characterM = {
    create: api.character.create.useMutation(),
    update: api.character.update.useMutation(),
    del: api.character.delete.useMutation(),
  };

  // Shared commit for enriched NPC/Character creates (unified path + cross-surface refresh).
  const enrichCommit = useEnrichmentCommit(campaignId);

  const npcOptions = npcs.map((n) => ({ value: n.id, label: n.name }));

  return (
    <div className="space-y-8">
      <CrudSection<NPC, typeof createNpcSchema._input>
        title="NPCs"
        itemLabel="NPC"
        initialItems={npcs}
        resolver={zodResolver(createNpcSchema)}
        fields={[
          { name: "name", label: "Name" },
          { name: "role", label: "Role" },
          { name: "status", label: "Status", placeholder: "alive" },
          { name: "description", label: "Description", control: "textarea" },
        ]}
        emptyDefaults={{ name: "", role: undefined, status: "alive", description: undefined }}
        toDefaults={(r) => ({
          name: r.name,
          role: r.role ?? undefined,
          status: r.status,
          description: r.description ?? undefined,
        })}
        rowTitle={(r) => r.name}
        rowMeta={(r) => r.role ?? null}
        createFn={(v) => npcM.create.mutateAsync({ ...v, campaignId })}
        updateFn={(id, v) => npcM.update.mutateAsync({ id, data: v })}
        deleteFn={(id) => npcM.del.mutateAsync({ id })}
        enrichment={{
          kind: "npc",
          campaignId,
          offerSrd: true,
          nameField: "name",
          commit: async (values, prov) => {
            const r = await enrichCommit.mutateAsync({
              action: "create",
              entity: "npc",
              campaignId,
              fields: values,
              source: prov.source,
              attribution: prov.attribution,
            });
            // Optimistic row; router.refresh() reconciles with the server shape.
            return {
              id: r.id,
              campaignId,
              ...values,
              source: prov.source,
              attribution: prov.attribution ?? null,
            } as unknown as NPC;
          },
        }}
      />

      <CrudSection<Session, typeof createSessionSchema._input>
        title="Sessions"
        itemLabel="session"
        initialItems={sessions}
        resolver={zodResolver(createSessionSchema)}
        fields={[
          { name: "title", label: "Title" },
          { name: "date", label: "Date", control: "datetime" },
          { name: "summary", label: "Summary", control: "textarea" },
          { name: "notes", label: "Notes", control: "textarea" },
        ]}
        emptyDefaults={{
          title: "",
          date: undefined,
          summary: undefined,
          notes: undefined,
        }}
        toDefaults={(r) => ({
          title: r.title,
          date: r.date,
          summary: r.summary ?? undefined,
          notes: r.notes ?? undefined,
        })}
        rowTitle={(r) => r.title}
        rowMeta={(r) => {
          // Fixed locale + UTC so server and client render identical text (avoids a
          // hydration mismatch from differing ambient locale/timezone).
          const when = new Date(r.date).toLocaleString("en-US", {
            timeZone: "UTC",
            dateStyle: "medium",
            timeStyle: "short",
          });
          // The AI summary is shown read-only (generated, not user-authored).
          return r.aiSummary ? `${when} · AI summary: ${r.aiSummary}` : when;
        }}
        createFn={(v) => sessionM.create.mutateAsync({ ...v, campaignId })}
        updateFn={(id, v) => sessionM.update.mutateAsync({ id, data: v })}
        deleteFn={(id) => sessionM.del.mutateAsync({ id })}
      />

      <CrudSection<Location, typeof createLocationSchema._input>
        title="Locations"
        itemLabel="location"
        initialItems={locations}
        resolver={zodResolver(createLocationSchema)}
        fields={[
          { name: "name", label: "Name" },
          { name: "description", label: "Description", control: "textarea" },
        ]}
        emptyDefaults={{ name: "", description: undefined }}
        toDefaults={(r) => ({
          name: r.name,
          description: r.description ?? undefined,
        })}
        rowTitle={(r) => r.name}
        createFn={(v) => locationM.create.mutateAsync({ ...v, campaignId })}
        updateFn={(id, v) => locationM.update.mutateAsync({ id, data: v })}
        deleteFn={(id) => locationM.del.mutateAsync({ id })}
      />

      <CrudSection<Item, typeof createItemSchema._input>
        title="Items"
        itemLabel="item"
        initialItems={items}
        resolver={zodResolver(createItemSchema)}
        fields={[
          { name: "name", label: "Name" },
          { name: "description", label: "Description", control: "textarea" },
          {
            name: "ownerNpcId",
            label: "Owner NPC",
            control: "select",
            placeholder: "— None —",
            options: [{ value: NONE, label: "— None —" }, ...npcOptions],
          },
        ]}
        emptyDefaults={{ name: "", description: undefined, ownerNpcId: NONE }}
        toDefaults={(r) => ({
          name: r.name,
          description: r.description ?? undefined,
          ownerNpcId: r.ownerNpcId ?? NONE,
        })}
        rowTitle={(r) => r.name}
        rowMeta={(r) =>
          r.ownerNpcId
            ? (npcs.find((n) => n.id === r.ownerNpcId)?.name ?? null)
            : null
        }
        createFn={(v) =>
          itemM.create.mutateAsync({
            ...v,
            ownerNpcId: v.ownerNpcId === NONE ? undefined : v.ownerNpcId,
            campaignId,
          })
        }
        updateFn={(id, v) =>
          itemM.update.mutateAsync({
            id,
            data: {
              ...v,
              ownerNpcId: v.ownerNpcId === NONE ? undefined : v.ownerNpcId,
            },
          })
        }
        deleteFn={(id) => itemM.del.mutateAsync({ id })}
      />

      <CrudSection<Character, typeof createCharacterSchema._input>
        title="Characters"
        itemLabel="character"
        initialItems={characters}
        resolver={zodResolver(createCharacterSchema)}
        fields={[
          { name: "name", label: "Name" },
          { name: "playerName", label: "Player" },
          { name: "class", label: "Class" },
          { name: "level", label: "Level", control: "number" },
          { name: "notes", label: "Notes", control: "textarea" },
        ]}
        emptyDefaults={{
          name: "",
          playerName: "",
          class: "",
          level: 1,
          notes: undefined,
        }}
        toDefaults={(r) => ({
          name: r.name,
          playerName: r.playerName,
          class: r.class,
          level: r.level,
          notes: r.notes ?? undefined,
        })}
        rowTitle={(r) => r.name}
        rowMeta={(r) => `${r.playerName} · ${r.class} (lvl ${r.level})`}
        createFn={(v) => characterM.create.mutateAsync({ ...v, campaignId })}
        updateFn={(id, v) => characterM.update.mutateAsync({ id, data: v })}
        deleteFn={(id) => characterM.del.mutateAsync({ id })}
        enrichment={{
          kind: "character",
          campaignId,
          // The open SRD covers monsters/NPCs, not player characters — agent generation only.
          offerSrd: false,
          nameField: "name",
          commit: async (values, prov) => {
            const r = await enrichCommit.mutateAsync({
              action: "create",
              entity: "character",
              campaignId,
              fields: values,
              source: prov.source,
              attribution: prov.attribution,
            });
            return {
              id: r.id,
              campaignId,
              ...values,
              source: prov.source,
              attribution: prov.attribution ?? null,
            } as unknown as Character;
          },
        }}
      />
    </div>
  );
}
