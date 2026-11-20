// Standard numbers from Ticket-02 and Ticket-03 (Contract v1.2). Single source of truth: game.contract.json
// mirrors TUNING (checked by test/contract.test.js). Do not change without a ticket.
export const TUNING = {
  player_speed: 6.0,        // m/s
  carry_capacity: 10,
  lantern_cost: 10,         // motes to light one lantern (can be deposited over several visits)
  lantern_count_night1: 5,
  pickup_radius: 1.0,       // XZ, plus |dy| <= 1.5
  interact_radius: 2.0,
  pulse_cost: 3,            // motes spent per Tỏa Sáng
  pulse_radius: 5,          // 3D, from player feet + 0.8
  night1_duration_s: 240,
  flames: 3,
  invuln_s: 1.5,            // 90 ticks
  hit_drop_ratio: 0.5,      // floor(carried / 2)
  pulse_stun_s: 2,          // 120 ticks
  pulse_push_m: 4,          // over the first 15 ticks of the stun
  pulse_cooldown_s: 3,
  safe_radius: 6,
  shade_speed: 4.0,         // Night 3: 4.5 (see maps.js)
  shade_hit_radius: 1.0,
  fall_enabled: true,
  dash_speed: 14,
  dash_duration_s: 0.2,
  dash_cooldown_s: 1.5,
  night2_duration_s: 270,
  night3_duration_s: 300,
  fuel_max: 100,
  fuel_decay_per_s: 1.0,
  fuel_per_mote: 10,
  relight_cost: 5,
  win_ratio: 0.6,
  drain_per_s: 5,
  low_fuel_threshold: 30,
  capacity_max: 20,
  // Ticket-03: per mote deposited/refuelled, first light, stun (15 if it was draining), no time bonus.
  score: { per_mote: 5, per_lantern: 100, per_stun: 5, per_second_left: 0, per_flame_left: 50, per_relight: 40, per_stun_drain: 15, per_lit_lantern_dawn: 50 },
};

// Other ticket constants (not part of the contract tuning block).
export const RULES = {
  capacity_per_light: 2,    // capacity = 10 + 2 * successful lights (max 20)
  drain_range_m: 2,
  drain_exit_player_m: 6,
  drain_event_every: 60,
  jump_speed: 7.0,
  gravity: 20.0,
  step_height: 0.35,        // max ledge a walker can step up
  fall_y: -10,
  fall_wait_ticks: 60,
  respawn_invuln_ticks: 90,
  pickup_dy: 1.5,
  hit_dy: 1.5,
  mote_start: 20,
  mote_cap: 30,
  mote_spawn_every: 240,
  dropped_ttl_ticks: 480,
  drop_ring_min: 1.5,
  drop_ring_max: 2.5,
  pulse_center_dy: 0.8,
  pulse_push_ticks: 15,
  detect_m: 12,
  lose_m: 18,
  recoil_m: 2,
  recoil_ticks: 60,
  spawning_ticks: 60,
  wander_speed: 1.5,
  safe_push_ticks: 30,
  shade_first_spawn_tick: 300,
  shade_first_spawn_count: 2,
  shade_spawn_min_dist: 15,
  drifter_speed: 7,
  drifter_idle_speed: 2,
  drifter_max: 2,
  drifter_every: 1200,
  drifter_trigger_carried: 5,
  drifter_trigger_m: 15,
  drifter_touch_m: 1.2,
  drifter_steal: 3,
  drifter_flee_ticks: 240,
  drifter_drop_vanish_ticks: 120,
  charm_ticks: 600,
  charm_respawn_ticks: 2700,
  charm_speed: 7.2,
  dash_charm_free: true,
  wind_every: 1800,
  wind_len: 300,
  wind_warn: 120,
  wind_push: 2,
};
