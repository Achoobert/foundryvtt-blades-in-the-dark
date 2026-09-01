// Assign Blades '68 Playbook
// Turns a blank character actor into a fully-loaded playbook character:
// sets the playbook, applies base skill pips, adds the first playbook
// ability, adds all playbook loadout items plus the universal gear list
// (prompting for a pick among any frame features, e.g. Hull's "choose two"),
// and creates the playbook's "Shady Friends" contacts as NPC actors linked
// to the character.
(async () => {
  const SYSTEM_ID = "blades68";

  const token = canvas.tokens.controlled[0];
  const actor = token?.actor ?? game.user.character;
  if (!actor) {
    ui.notifications.warn("Select a token (or set a default character) first.");
    return;
  }
  if (actor.type !== "character") {
    ui.notifications.warn(`${actor.name} isn't a character actor.`);
    return;
  }

  const { openFormDialog } = await import(
    foundry.utils.getRoute(`systems/${SYSTEM_ID}/module/lib/dialog-compat.js`)
  );

  const classPack = game.packs.get(`${SYSTEM_ID}.blades68_classes`);
  const abilityPack = game.packs.get(`${SYSTEM_ID}.blades68_abilities`);
  const itemPack = game.packs.get(`${SYSTEM_ID}.blades68_items`);
  if (!classPack || !abilityPack || !itemPack) {
    ui.notifications.error("Blades '68 content compendiums are not available.");
    return;
  }

  const classItems = (await classPack.getDocuments()).sort((a, b) => a.name.localeCompare(b.name));
  const options = classItems.map(i => `<option value="${i.name}">${i.name}</option>`).join("");

  const existingWarning = actor.system.playbook
    ? `<p style="color:#a33"><strong>Note:</strong> ${actor.name} is already a ${actor.system.playbook}. Re-running will add duplicate items/contacts.</p>`
    : "";

  const result = await openFormDialog({
    title: "Assign Blades '68 Playbook",
    content: `
      <form>
        ${existingWarning}
        <div class="form-group">
          <label>Playbook</label>
          <select name="playbook" style="width:100%">${options}</select>
        </div>
      </form>
    `,
    okLabel: "Assign",
    cancelLabel: "Cancel",
  });
  if (!result?.playbook) return;

  const chosen = result.playbook;
  const classItem = classItems.find(i => i.name === chosen);

  const setupUrl = foundry.utils.getRoute(`systems/${SYSTEM_ID}/module/data/blades68-playbook-setup.json`);
  const allSetup = await (await fetch(setupUrl)).json();
  const pbSetup = allSetup[chosen] ?? { contacts: [], firstAbilityName: null };

  // --- Playbook + base skill pips ---
  const skillToAttr = {
    hunt: "insight", study: "insight", survey: "insight", tinker: "insight",
    finesse: "prowess", prowl: "prowess", skirmish: "prowess", wreck: "prowess",
    attune: "resolve", command: "resolve", consort: "resolve", sway: "resolve",
  };
  const actorUpdate = { "system.playbook": chosen };
  for (const [skill, pips] of Object.entries(classItem.system.base_skills ?? {})) {
    const value = Number(pips?.[0] ?? 0);
    const attr = skillToAttr[skill];
    if (!attr) continue;
    const max = actor.system.attributes[attr].skills[skill].max ?? 3;
    actorUpdate[`system.attributes.${attr}.skills.${skill}.value`] = Math.min(max, value);
  }
  await actor.update(actorUpdate);

  // --- First playbook ability + loadout items ---
  const abilityItems = await abilityPack.getDocuments();
  const firstAbility = abilityItems.find(
    i => i.system.class === chosen && i.name === pbSetup.firstAbilityName
  );
  const itemsToCreate = [];
  if (firstAbility) itemsToCreate.push(firstAbility.toObject());
  else ui.notifications.warn(`No starting ability found for ${chosen}.`);

  const itemPackItems = await itemPack.getDocuments();
  const loadoutItems = itemPackItems.filter(i => i.system.class === chosen);
  const frameFeatureItems = loadoutItems.filter(i => i.system.additional_info === "frame_feature");
  const gearItems = loadoutItems.filter(i => i.system.additional_info !== "frame_feature");
  const universalItems = itemPackItems.filter(i => i.system.class === "");
  for (const item of [...gearItems, ...universalItems]) itemsToCreate.push(item.toObject());

  // Frame features (e.g. Hull's "choose two") aren't auto-granted like gear -
  // prompt for a pick among the class's available options instead.
  if (frameFeatureItems.length) {
    const featureOptions = frameFeatureItems
      .map(i => `
        <div class="form-group">
          <label><input type="checkbox" name="frameFeature" value="${i.name}"> ${i.name}</label>
        </div>
      `)
      .join("");
    const featureResult = await openFormDialog({
      title: `${chosen} Frame Features`,
      content: `
        <form>
          <p>Choose two frame features.</p>
          ${featureOptions}
        </form>
      `,
      okLabel: "Add Features",
      cancelLabel: "Skip",
    });
    const picked = featureResult?.frameFeature
      ? [].concat(featureResult.frameFeature)
      : [];
    for (const item of frameFeatureItems.filter(i => picked.includes(i.name))) {
      itemsToCreate.push(item.toObject());
    }
  }

  if (itemsToCreate.length) await actor.createEmbeddedDocuments("Item", itemsToCreate);

  // --- Contacts: create NPC actors in PC_contacts/<actor name>, link as acquaintances ---
  if (pbSetup.contacts?.length) {
    let rootFolder = game.folders.find(f => f.type === "Actor" && f.name === "PC_contacts" && !f.folder);
    if (!rootFolder) rootFolder = await Folder.create({ name: "PC_contacts", type: "Actor" });

    let actorFolder = game.folders.find(
      f => f.type === "Actor" && f.name === actor.name && f.folder === rootFolder.id
    );
    if (!actorFolder) {
      actorFolder = await Folder.create({ name: actor.name, type: "Actor", folder: rootFolder.id });
    }

    const npcData = pbSetup.contacts.map(c => ({
      name: c.name,
      type: "npc",
      folder: actorFolder.id,
      system: { description_short: c.description_short, associated_class: chosen },
    }));
    const createdNpcs = await Actor.createDocuments(npcData);

    const acquaintances = foundry.utils.deepClone(actor.system.acquaintances ?? []);
    for (const npc of createdNpcs) {
      acquaintances.push({
        id: npc.id,
        name: npc.name,
        description_short: npc.system.description_short,
        standing: "neutral",
      });
    }
    await actor.update({ "system.acquaintances": acquaintances });
  }

  ui.notifications.info(`${actor.name} is now a ${chosen}.`);
})();
