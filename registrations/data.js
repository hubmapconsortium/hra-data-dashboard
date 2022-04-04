function getSamples(token, from, size) {
  return fetch('https://search.api.hubmapconsortium.org/portal/search', {
    method: 'POST',
    headers: token ?
      { 'Content-type': 'application/json', 'Authorization': `Bearer ${token}` } : 
      { 'Content-type': 'application/json' },
    body: JSON.stringify({
      version: true,
      from,
      size,
      stored_fields: ['*'],
      script_fields: {},
      docvalue_fields: [],
      query: {
        bool: {
          must_not: {
            term: { 'group_name.keyword': 'Vanderbilt TMC' }
          },
          filter: {
            term: { 'entity_type.keyword': 'Sample' }
          }
        }
      },
      _source: {
        includes: [
          'data_access_level', 'uuid', 'hubmap_id', 'entity_type', 'mapped_organ', 'mapped_specimen_type', 'immediate_ancestors', 'rui_location', 'group_uuid', 'group_name', 'mapped_consortium'
        ]
      }
    })
  }).then(r => r.json())
  .then(r => { console.log(r.hits.total.value, r.hits.hits.map(n => n._source)); return r })
  .then(r => r.hits.hits.map(n => Object.assign(n._source)));
}

function getVanderbiltSamples(token, organ, from, size) {
  return fetch('https://search.api.hubmapconsortium.org/portal/search', {
    method: 'POST',
    headers: token ?
      { 'Content-type': 'application/json', 'Authorization': `Bearer ${token}` } : 
      { 'Content-type': 'application/json' },
    body: JSON.stringify({
      version: true,
      from,
      size,
      stored_fields: ['*'],
      script_fields: {},
      docvalue_fields: [],
      query: {
        bool: {
          must: {
            term: { 'group_name.keyword': 'Vanderbilt TMC' }
          },
          must_not: {
            term: { 'origin_sample.organ.keyword': organ }
          },
          filter: {
            term: { 'entity_type.keyword': 'Sample' }
          }
        }
      },
      _source: {
        includes: [
          'data_access_level', 'uuid', 'hubmap_id', 'entity_type', 'mapped_organ', 'mapped_specimen_type', 'immediate_ancestors', 'rui_location', 'group_uuid', 'group_name', 'mapped_consortium'
        ]
      }
    })
  }).then(r => r.json())
  .then(r => { console.log(r.hits.total.value, r.hits.hits.map(n => n._source)); return r })
  .then(r => r.hits.hits.map(n => Object.assign(n._source)));
}

async function getAllEntities(token) {
  return [
    ...await getSamples(token, 0, 10000),
    ...await getVanderbiltSamples(token, 'LK', 0, 10000),
    ...await getVanderbiltSamples(token, 'RK', 0, 5000),
    // ...await getVanderbiltSamples(token, 'RK', 5000, 5000)
  ];
}

function createEntityGraph(samples) {
  const nodes = {
    'root': {
      data: { id: 'root', label: '', status: 'N/A', entity_type: 'Empty' }
    }
  };
  const edges = {};
  for (const sample of samples) {
    const ancestor = (sample.immediate_ancestors || [{}])[0];
    const hasRuiLocation = !!sample.rui_location;
    const hasAncestorRuiLocation = !!ancestor.rui_location;
    const isSection = (sample.mapped_specimen_type || '').toLowerCase().indexOf('section') !== -1;

    let status;
    if (hasRuiLocation) {
      status = 'Registered Block';
    } else if (hasAncestorRuiLocation) {
      status = 'Registered Section';
    } else if (isSection) {
      status = 'Unregistered Section';
    } else {
      status = 'Unregistered Block';
    }
    
    // Consortium
    if (!nodes[sample.mapped_consortium]) {
      nodes[sample.mapped_consortium] = {
        data: { id: sample.mapped_consortium, label: sample.mapped_consortium, published: 'public', status: 'N/A', entity_type: 'Consortium' }
      }
      edges['root-'+sample.mapped_consortium] = {
        data: { id: 'root-'+sample.mapped_consortium, source: 'root', target: sample.mapped_consortium }
      };
    }

    // Tissue Provider
    if (!nodes[sample.group_uuid]) {
      nodes[sample.group_uuid] = {
        data: { id: sample.group_uuid, label: sample.group_name, published: 'public', status: 'N/A', entity_type: 'TissueProvider' }
      };
      edges[sample.mapped_consortium+'-'+sample.group_uuid] = {
        data: { id: sample.mapped_consortium+'-'+sample.group_uuid, source: sample.mapped_consortium, target: sample.group_uuid }
      };
    }

    // Donor
    if (ancestor.entity_type === 'Donor' && !nodes[ancestor.uuid]) {
      nodes[ancestor.uuid] = {
        data: { id: ancestor.uuid, label: ancestor.hubmap_id, published: ancestor.data_access_level, status: 'N/A', entity_type: ancestor.entity_type, entity: ancestor, provider: sample.group_name }
      };
      edges[ancestor.group_uuid+'-'+ancestor.uuid] = {
        data: { id: ancestor.group_uuid+'-'+ancestor.uuid, source: ancestor.group_uuid, target: ancestor.uuid }
      };
    }

    // Sample
    nodes[sample.uuid] = {
      data: { id: sample.uuid, label: sample.hubmap_id, status, published: sample.data_access_level, entity_type: sample.entity_type, specimen_type: sample.mapped_specimen_type, organ: sample.mapped_organ, entity: sample, provider: sample.group_name }
    }

    // Parent Sample
    if (ancestor.uuid) {
      if (!nodes[ancestor.uuid]) {
        const isAncestorSection = (ancestor.specimen_type || '').toLowerCase().indexOf('section') !== -1;
        if (hasAncestorRuiLocation) {
          ancestorStatus = 'Registered Block';
        } else if (isAncestorSection) {
          ancestorStatus = 'Unregistered Section';
        } else {
          ancestorStatus = 'Unregistered Block';
        }
        nodes[ancestor.uuid] = { data: { id: ancestor.uuid, label: ancestor.hubmap_id, published: ancestor.data_access_level, status: ancestorStatus, entity_type: ancestor.entity_type, specimen_type: ancestor.specimen_type, entity: ancestor, provider: sample.group_name } };
      }

      edges[ancestor.uuid+'-'+sample.uuid] = {
        data: { id: ancestor.uuid+'-'+sample.uuid, source: ancestor.uuid, target: sample.uuid }
      };
    }
  }

  const nodesArray = Object.values(nodes);
  nodesArray.forEach(n => {
    if (n.data.entity_type === 'Sample' && 
        !(n.data.specimen_type === 'Organ piece' && n.data.status.indexOf('Unregistered') === 0) &&
        !(n.data.specimen_type === 'Organ' && n.data.status.indexOf('Unregistered') === 0)
      ) {
      n.data.published_status = n.data.published === 'public' ? 'Published' : 'Unpublished';
      switch (n.data.status) {
      case 'Registered Block':
        n.data.status_color = '#1a9641';
        break;
      case 'Registered Section':
        n.data.status_color = '#a6d96a';
        break;
      case 'Unknown':
        n.data.status_color = '#000000';
        break;
      case 'Unregistered Block':
        n.data.status_color = '#d7191c';
        break;
      case 'Unregistered Section':
        n.data.status_color = '#fdae61';
        break;
      }
    }
  });
  return { nodes: nodesArray, edges: Object.values(edges) };
}
