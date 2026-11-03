App({
  globalData: { session: null },
  onLaunch() { require('./utils/api').session().catch(() => {}); }
});
