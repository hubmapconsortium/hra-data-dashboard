async function setApiKey() {
  const apiKey = prompt('Enter API Key (leave blank to clear)', '');
  localStorage.removeItem('HUBMAP_KEY');
  if (apiKey.trim().length > 0) {
    localStorage.setItem('HUBMAP_KEY', apiKey);
  }
  await idbKeyval.del('x');
  location.reload();
}

async function createCachedSampleGraph() {
  const initialized = sessionStorage.getItem('INITIALIZED') == 'true';
  const token = localStorage.getItem('HUBMAP_KEY') || undefined;
  let samples = [];
  const storedSample = initialized ? await idbKeyval.get('x') : '';
  if (storedSample) {
    samples = JSON.parse(storedSample);
  } else {
    samples = await getAllEntities(token);  
    try {
      await idbKeyval.set('x', JSON.stringify(samples));
      sessionStorage.setItem('INITIALIZED', 'true');
    } catch (e) {
      console.log('Result set too large to cache.');
    }
  }
  return createEntityGraph(samples);
}
