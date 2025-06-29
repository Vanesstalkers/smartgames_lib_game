export default {
  path: '/game/:id',
  name: 'Game',
  component: function () {
    return import('./Game.vue');
  },
};
