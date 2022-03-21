async function buildVega(graph) {
  const spec = await fetch("vis.vl.json").then((result) => result.json());
  spec.datasets.nodes = graph.nodes.map(n => n.data).filter(n => !!n.status_color);
  spec.datasets.nodes = spec.datasets.nodes.concat(
    spec.datasets.nodes.map(n => ({ ...n, provider: 'All Tissue Providers' }))
  );

  return await vegaEmbed("#visualization", spec, { "renderer": "canvas", "actions": true });
}

async function main() {
  const graph = await createCachedSampleGraph();
  vega = await buildVega(graph);
}
window.addEventListener('DOMContentLoaded', main);
