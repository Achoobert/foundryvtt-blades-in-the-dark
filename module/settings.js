export const registerSystemSettings = function() {

  /**
   * Track the system version upon which point a migration was last applied
   */
  game.settings.register("bitd", "systemMigrationVersion", {
    name: "System Migration Version",
    scope: "world",
    config: false,
    type: Number,
    default: 0
  });
  
  if (foundry.utils.isNewerVersion(game.version, 12)) {

    game.settings.register('blades68', 'ActionRoll', {
	name: game.i18n.localize('BITD.Settings.Action.Name'),
	hint: game.i18n.localize('BITD.Settings.Action.Hint'),
	config: true,
	default: true,
	scope: 'world',
	type: new foundry.data.fields.BooleanField(),
	requiresReload: true
  });
	
	game.settings.register('blades68', 'ThreatRoll', {
	name: game.i18n.localize('BITD.Settings.Threat.Name'),
	hint: game.i18n.localize('BITD.Settings.Threat.Hint'),
	config: true,
	scope: 'world',
	type: new foundry.data.fields.BooleanField(),
	requiresReload: true
  });
  
  game.settings.register('blades68', 'PushYourself', {
	name: game.i18n.localize('BITD.Settings.Push.Name'),
	hint: game.i18n.localize('BITD.Settings.Push.Hint'),
	config: true,
	scope: 'world',
	type: new foundry.data.fields.BooleanField(),
	requiresReload: true
  });
  
    game.settings.register('blades68', 'DeepCutLoad', {
	name: game.i18n.localize('BITD.Settings.Load.Name'),
	hint: game.i18n.localize('BITD.Settings.Load.Hint'),
	config: true,
	scope: 'world',
	type: new foundry.data.fields.BooleanField(),
	requiresReload: true
  });
  
    game.settings.register('blades68', 'ClockXP', {
	name: game.i18n.localize('BITD.Settings.ClockXP.Name'),
	hint: game.i18n.localize('BITD.Settings.ClockXP.Hint'),
	config: true,
	scope: 'world',
	type: new foundry.data.fields.BooleanField(),
	requiresReload: true
  });
  
    game.settings.register('blades68', 'Edge', {
	name: game.i18n.localize('BITD.Settings.Edge.Name'),
	hint: game.i18n.localize('BITD.Settings.Edge.Hint'),
	config: true,
	scope: 'world',
	type: new foundry.data.fields.BooleanField(),
	requiresReload: true
  });
  
  	game.settings.register('blades68', 'PublicClocks', {
	name: game.i18n.localize('BITD.Settings.PublicClocks.Name'),
	hint: game.i18n.localize('BITD.Settings.PublicClocks.Hint'),
	config: true,
	scope: 'world',
	type: new foundry.data.fields.BooleanField(),
	requiresReload: true
  });

  	game.settings.register('blades68', 'Blades68Mode', {
	name: game.i18n.localize('BITD.Settings.Blades68.Name'),
	hint: game.i18n.localize('BITD.Settings.Blades68.Hint'),
	config: true,
	default: false,
	scope: 'world',
	type: new foundry.data.fields.BooleanField(),
	requiresReload: true
  });

  } //end if for game.version >12
  else {
	  
  const set_array = [
    ['ActionRoll','Action', true],
    ['ThreatRoll','Threat', false],
    ['PushYourself','Push', false],
    ['DeepCutLoad','Load', false],
    ['ClockXP','ClockXP', false],
    ['Edge','Edge', false],
    ['PublicClocks','PublicClocks', false],
    ['Blades68Mode','Blades68', false]
  ];
 
  for (let i=0; i<set_array.length; i++) {
	  
	game.settings.register('blades68', set_array[i][0], {
		name: game.i18n.localize('BITD.Settings.'+set_array[i][1]+'.Name'),
		hint: game.i18n.localize('BITD.Settings.'+set_array[i][1]+'.Hint'),
		config: true,
		scope: 'world',
		type: Boolean,
		default: set_array[i][2],
		requiresReload: true
	});
  }
	  
  }

};
