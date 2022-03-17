function buildCyGraph(elements) {
  const cy = cytoscape({
    container: document.getElementById('cy'),
    elements,
    style: [ // the stylesheet for the graph
      {
        selector: 'node',
        style: {
          'background-color': '#666',
          'border-color': '#cccccc',
          'border-width': 2,
          'label': 'data(label)',
          'width': 90,
          'height': 90,
          'shape': 'ellipse'
        }
      },

      {
        selector: `node[entity_type = 'Empty']`,
        style: {
          'width': 0,
          'height': 0
        }
      },
      {
        selector: `node[entity_type = 'Consortium']`,
        style: {
          'shape': 'star'
        }
      },
      {
        selector: `node[entity_type = 'TissueProvider']`,
        style: {
          'shape': 'diamond'
        }
      },
      {
        selector: `node[entity_type = 'Donor']`,
        style: {
          'shape': 'triangle'
        }
      },
      {
        selector: `node[entity_type = 'Sample']`,
        style: {
          'shape': 'ellipse',
          'label': 'data(specimen_type)',
          'width': 50,
          'height': 50,
        }
      },
      {
        selector: `node[status = 'N/A']`,
        style: {
          'background-color': '#0571b0'
        }
      },
      {
        selector: `node[specimen_type = 'Organ piece']`,
        style: {
          'background-color': '#0571b0',
          'shape': 'octagon',
          'width': 70,
          'height': 70,
        }
      },
      {
        selector: `node[status = 'Registered Block']`,
        style: {
          'background-color': '#1a9641'
        }
      },
      {
        selector: `node[status = 'Registered Section']`,
        style: {
          'background-color': '#a6d96a'
        }
      },
      {
        selector: `node[status = 'Unknown']`,
        style: {
          'background-color': '#ffffbf'
        }
      },
      {
        selector: `node[status = 'Unregistered Block']`,
        style: {
          'background-color': '#d7191c'
        }
      },
      {
        selector: `node[status = 'Unregistered Section']`,
        style: {
          'background-color': '#fdae61'
        }
      },
      {
        selector: `node[specimen_type = 'Organ']`,
        style: {
          'background-color': '#0571b0',
          'label': 'data(organ)',
          'shape': 'hexagon',
          'width': 70,
          'height': 70,
        }
      },

      {
        selector: 'edge',
        style: {
          'width': 3,
          'line-color': '#ccc',
          'target-arrow-color': '#ccc',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier'
        }
      }
    ]
  });

  return cy;
}

function addProviderChooser(cy, graph) {
  const providers = graph.nodes
    .filter(n => n.data.entity_type === 'TissueProvider')
    .sort((a, b) => a.data.label.localeCompare(b.data.label));
  
  const select = document.getElementById('rootNode');
  for (const provider of providers) {
    const option = document.createElement('option');
    option.innerHTML = provider.data.label;
    option.value = provider.data.id;
    select.appendChild(option);
  }

  select.addEventListener('change', (e) => {
    const root = e.target.value;
    doCircleLayout(cy, root);
  });
}

function doCircleLayout(cy, root) {
  cy.elements().style('visibility', 'hidden');
  cy.elements().bfs({
    directed: true,
    root: `#${root}`,
    visit: function(v, e, u, i, depth) {
      v.data('level', 100 - depth * 5);
      v.style('visibility', 'visible');
      if (e) e.style('visibility', 'visible');
    }
  });

  cy.layout({
    name: 'breadthfirst',
    directed: true,
    circle: true,
    spacingFactor: 4.5,
    roots: `#${root}`
  }).run();

  // cy.layout({
  //   name: 'concentric',
  //   directed: true,
  //   equidistant: false,
  //   spacingFactor: 0.5,
  //   concentric: (node) => node.data('level'),
  //   levelWidth: (_nodes) => 5
  // }).run();
}

function setApiKey() {
  const apiKey = prompt('Enter API Key (leave blank to clear)', '');
  localStorage.removeItem('HUBMAP_KEY');
  if (apiKey.trim().length > 0) {
    localStorage.setItem('HUBMAP_KEY', apiKey);
  }
  location.reload();
}

async function main() {
  const token = localStorage.getItem('HUBMAP_KEY') || undefined;
  if (!token) {
    setApiKey();
  }
  let samples = [];
  if (sessionStorage.getItem('x')) {
    samples = JSON.parse(sessionStorage.getItem('x'));
  } else {
    samples = await getAllEntities(token);  
    sessionStorage.setItem('x', JSON.stringify(samples));
  }
  const graph = createEntityGraph(samples);
  console.log(graph);
  cy = buildCyGraph(graph);

  cy.on('tap', 'node', function(evt){
    const node = evt.target;
    window.open(`https://portal.hubmapconsortium.org/browse/${node.data('label')}`, '_blank');
  });

  addProviderChooser(cy, graph);
  doCircleLayout(cy, 'root');
}
main();
