const { agentcache } = require('../dist');

console.log('✅ SDK Imported');
console.log('Client:', agentcache);

agentcache.get('test').then(val => {
    console.log('✅ Get Result:', val);
}).catch(err => {
    console.error('❌ Get Error:', err);
});
