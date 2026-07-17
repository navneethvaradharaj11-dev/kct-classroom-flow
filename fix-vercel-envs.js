const { execSync } = require('child_process');
const pushEnv = (key, val) => {
  try { execSync(`npx vercel env rm ${key} production -y`, { stdio: 'ignore' }); } catch(e){}
  execSync(`npx vercel env add ${key} production`, { input: val });
  console.log(`Added ${key}`);
};
pushEnv('VITE_SUPABASE_URL', 'https://zojnzycfwstyubqinztd.supabase.co');
pushEnv('VITE_SUPABASE_PROJECT_ID', 'zojnzycfwstyubqinztd');
pushEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_uoMpgz1BZW2WocmeNWXg4A_bNQACBlD');
console.log('Fixed env vars!');
