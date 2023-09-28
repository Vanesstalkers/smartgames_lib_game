export default {
  path: '/game/release/:id',
  name: 'Release Game',
  component: function () {
    return import('./Game.vue');
  },
};
