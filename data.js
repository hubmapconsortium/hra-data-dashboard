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
          // must: {
          //   term: { 'group_name.keyword': 'University of Florida TMC' }
          // },
          filter: {
            term: { 'entity_type.keyword': 'Sample' }
          }
        }
      },
      _source: {
        includes: [
          'uuid', 'hubmap_id', 'entity_type', 'mapped_organ', 'mapped_specimen_type', 'immediate_ancestors', 'rui_location', 'group_uuid', 'group_name', 'mapped_consortium'
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
          'uuid', 'hubmap_id', 'entity_type', 'mapped_organ', 'mapped_specimen_type', 'immediate_ancestors', 'rui_location', 'group_uuid', 'group_name', 'mapped_consortium'
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
    ...await getVanderbiltSamples(token, 'RK', 5000, 5000)
  ];
}

function createEntityGraph(samples) {
  const nodes = {
    'root': {
      data: { id: 'root', label: '', status: 'N/A', entity_type: 'Empty' }
    }
  };
  const edges = [];
  for (const sample of samples) {
    const ancestor = (sample.immediate_ancestors || [{}])[0];
    const hasRuiLocation = !!sample.rui_location;
    const hasAncestorRuiLocation = !!ancestor.rui_location;
    const status = hasRuiLocation ? 'Registered Block' : hasAncestorRuiLocation ? 'Registered Section' : (sample.mapped_specimen_type || '').toLowerCase().indexOf('section') !== -1 ? 'Unregistered Section' : 'Unregistered Block';
    
    // Consortium
    if (!nodes[sample.mapped_consortium]) {
      nodes[sample.mapped_consortium] = {
        data: { id: sample.mapped_consortium, label: sample.mapped_consortium, status: 'N/A', entity_type: 'Consortium' }
      }
      edges.push({
        data: { id: 'root-'+sample.mapped_consortium, source: 'root', target: sample.mapped_consortium }
      });
    }

    // Tissue Provider
    if (!nodes[sample.group_uuid]) {
      nodes[sample.group_uuid] = {
        data: { id: sample.group_uuid, label: sample.group_name, status: 'N/A', entity_type: 'TissueProvider' }
      };
      edges.push({
        data: { id: sample.mapped_consortium+'-'+sample.group_uuid, source: sample.mapped_consortium, target: sample.group_uuid }
      });
    }

    // Donor
    if (ancestor.entity_type === 'Donor' && !nodes[ancestor.uuid]) {
      nodes[ancestor.uuid] = {
        data: { id: ancestor.uuid, label: ancestor.hubmap_id, status: 'N/A', entity_type: ancestor.entity_type, entity: ancestor }
      };
      edges.push({
        data: { id: ancestor.group_uuid+'-'+ancestor.uuid, source: ancestor.group_uuid, target: ancestor.uuid }
      });
    }

    // Samples
    nodes[sample.uuid] = {
      data: { id: sample.uuid, label: sample.hubmap_id, status, entity_type: sample.entity_type, specimen_type: sample.mapped_specimen_type, organ: sample.mapped_organ, entity: sample }
    }
    if (ancestor.uuid) {
      if (!nodes[ancestor.uuid]) {
        nodes[ancestor.uuid] = { data: { id: ancestor.uuid, label: ancestor.hubmap_id, status: hasAncestorRuiLocation ? 'Registered Block' : 'Unknown', entity_type: ancestor.entity_type, specimen_type: ancestor.specimen_type, entity: ancestor } };
      }

      edges.push({
        data: { id: ancestor.uuid+'-'+sample.uuid, source: ancestor.uuid, target: sample.uuid }
      });
    }
  }

  const nodesArray = Object.values(nodes);
  return { nodes: nodesArray, edges };
}
