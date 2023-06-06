let table;
function downloadTable() {
  if (table) {
    table.download("csv", "data.csv");
  }
}

async function buildVega(graph) {
  const spec = await fetch("vis.vl.json").then((result) => result.json());
  spec.datasets.nodes = graph.nodes.map(n => n.data).filter(n => !!n.status_color);
  spec.datasets.nodes = spec.datasets.nodes.concat(
    spec.datasets.nodes.map(n => ({ ...n, provider: 'All Tissue Providers' }))
  );

  table = new Tabulator("#table", {
    data: spec.datasets.nodes.map(n => (
      {
        'HuBMAP ID': n.label,
        'Submission ID': n.submission_id,
        'Creator': n.creator,
        'Provider': n.provider,
        'Publication Status': n.published_status,
        'RUI Registration Status': n.status,
        'Donor HuBMAP ID': n.donor_hubmap_id,
        'Donor Submision ID': n.donor_submission_id
      }
    )).filter((n) => n.Provider !== 'All Tissue Providers'),
    autoColumns: true,
    initialSort: [
      { column: 'Provider', dir: 'asc' },
      { column: 'Publication Status', dir: 'asc' }
    ]
  });

  table.on("rowClick", function(_e, row){
    const hubmapId = row.getData()['HuBMAP ID'];
    window.open(`https://portal.hubmapconsortium.org/browse/${hubmapId}`, '_blank');
  });

  return await vegaEmbed("#visualization", spec, { "renderer": "canvas", "actions": true });
}

async function main() {
  const graph = await createCachedSampleGraph();
  vega = await buildVega(graph);
}
window.addEventListener('DOMContentLoaded', main);
