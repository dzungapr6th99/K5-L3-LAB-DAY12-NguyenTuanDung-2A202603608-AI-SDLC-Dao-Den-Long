// Single source of truth for every gameplay number. game.contract.json mirrors this
// (checked by test/contract.test.js).
export const TUNING = {
  player_speed: 6,          // m/s on the XZ plane
  carry_capacity: 5,        // max motes (light) carried
  lantern_cost: 8,          // motes needed to light one lantern
  lantern_count_night1: 5,
  pickup_radius: 1.5,       // auto pickup of motes
  interact_radius: 3,       // deposit range to a lantern
  pulse_cost: 1,            // motes spent per pulse
  pulse_radius: 8,
  night1_duration_s: 300,
  flames: 3,                // health
  invuln_s: 2,              // invulnerability after being hit
  hit_drop_ratio: 0.5,      // fraction of carried motes dropped when hit (floor)
  pulse_stun_s: 3,
  pulse_push_m: 3,
  pulse_cooldown_s: 2,
  safe_radius: 5,           // shades cannot enter this radius around a LIT lantern
  shade_speed: 3.5,
  shade_hit_radius: 1.2,
  fall_enabled: false,      // island edge is a soft wall, no fall penalty
  score: { per_mote: 10, per_lantern: 100, per_stun: 25, per_second_left: 1, per_flame_left: 50 },
};

// Internal (non-contract) constants.
export const WORLD = {
  island_radius: 40,
  lantern_ring_radius: 25,
  jump_speed: 6,
  gravity: 18,
  random_mote_count: 40,
  mote_respawn_ticks: 120,
  initial_shades: 2,
  shade_spawn_interval_s: 20,
  shade_max: 5,
  shade_spawn_min_dist: 20,
  hit_scatter_min: 2.5,
  hit_scatter_max: 4,
  shade_y: 1.0,
};
