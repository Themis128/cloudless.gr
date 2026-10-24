(function(){
  var tools=[
    {name:'list_endpoints',description:'List agent discovery endpoints on cloud.cloudless.gr',inputSchema:{type:'object',properties:{}},execute:async function(){return {endpoints:['/ocs/v2.php','/remote.php/dav','/status.php','/.well-known/api-catalog','/.well-known/agent.json','/auth.md']};}},
    {name:'check_status',description:'Check Nextcloud server status',inputSchema:{type:'object',properties:{}},execute:async function(){var r=await fetch('/status.php');return await r.json();}}
  ];
  function tg(){return [document,navigator,window].map(function(o){try{return o&&o.modelContext}catch(e){return null}}).filter(Boolean)}
  function reg(){var t=tg();if(!t.length)return false;t.forEach(function(mc){try{if(mc.registerTool)tools.forEach(function(tool){void mc.registerTool(tool)});if(mc.provideContext)mc.provideContext({tools:tools})}catch(e){}});return true}
  ['document','navigator','window'].forEach(function(k){try{var o=k==='document'?document:(k==='navigator'?navigator:window);var cur=o.modelContext;Object.defineProperty(o,'modelContext',{configurable:true,enumerable:true,get:function(){return cur},set:function(v){cur=v;reg()}})}catch(e){}});
  if(!reg()){var n=0,iv=setInterval(function(){if(reg()||++n>240)clearInterval(iv)},250)}
  window.addEventListener('load',reg);window.addEventListener('DOMContentLoaded',reg);
})();
