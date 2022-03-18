async function buildVega(graph) {
  const spec = await fetch("vis.vl.json").then((result) => result.json());
  spec.datasets.nodes = graph.nodes;
  return await vegaEmbed("#visualization", spec, { "renderer": "canvas", "actions": true });
}

async function main() {
  const graph = await createCachedSampleGraph();
  vega = await buildVega(graph);
}
window.addEventListener('DOMContentLoaded', main);
