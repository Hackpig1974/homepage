import truenasProxyHandler from "utils/proxy/handlers/truenas";

const widget = {
  api: "{url}/api/v2.0/{endpoint}",
  proxyHandler: truenasProxyHandler,

  mappings: {
    alerts: {
      endpoint: "alert/list",
      map: (data) => ({
        pending: Array.isArray(data) ? data.filter((item) => item?.dismissed === false).length : 0,
      }),
    },
    status: {
      endpoint: "system/info",
    },
    pools: {
      endpoint: "pool",
      map: (data) => ({
        total: data?.reduce((acc, pool) => acc + pool.size, 0),
        used: data?.reduce((acc, pool) => acc + pool.allocated, 0),
      }),
    },
    dataset: {
      endpoint: "pool/dataset",
      map: (data) => ({
        total: data?.reduce((acc, dataset) => acc + dataset.available + dataset.used, 0),
        used: data?.reduce((acc, dataset) => acc + dataset.used, 0),
      }),
    },
  },
};

export default widget;
