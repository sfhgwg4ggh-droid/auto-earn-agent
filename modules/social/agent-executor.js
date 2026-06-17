export async function executeSocial(state) {
  console.log('\n📱 [Social] 小红书+闲鱼每日内容生成...');
  try {
    const { runSocialPipeline } = await import('./social-pipeline.js');
    const checklist = await runSocialPipeline();
    state.lastSocialAt = new Date().toISOString();
    state.consecutiveErrors = 0;
    const xhs = checklist?.platforms?.xiaohongshu?.postsGenerated || 0;
    const xy = checklist?.platforms?.xianyu?.listingsGenerated || 0;
    console.log('[Social] ✅ 小红书 ' + xhs + ' 篇, 闲鱼 ' + xy + ' 个');
  } catch (err) {
    console.error('[Social] ❌', err.message);
    state.consecutiveErrors++;
  }
}
export default { executeSocial };
