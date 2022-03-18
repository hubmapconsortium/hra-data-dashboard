function setApiKey() {
  const apiKey = prompt('Enter API Key (leave blank to clear)', '');
  localStorage.removeItem('HUBMAP_KEY');
  if (apiKey.trim().length > 0) {
    localStorage.setItem('HUBMAP_KEY', apiKey);
  }
  sessionStorage.removeItem('x');
  location.reload();
}

async function createCachedSampleGraph() {
  const token = localStorage.getItem('HUBMAP_KEY') || undefined;
  let samples = [];
  if (sessionStorage.getItem('x')) {
    samples = JSON.parse(sessionStorage.getItem('x'));
  } else {
    samples = await getAllEntities(token);  
    try {
      sessionStorage.setItem('x', JSON.stringify(samples));
    } catch (e) {
      console.log('Result set too large to cache.');
    }
  }
  return createEntityGraph(samples);
}
