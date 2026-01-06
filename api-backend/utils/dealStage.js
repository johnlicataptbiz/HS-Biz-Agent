const wonStages = [
  "closedwon",
  "won",
  "wondeal",
  "dealwon",
  "closedwondeal",
  "9567249",
];

const lostStages = [
  "closedlost",
  "lost",
  "lostdeal",
  "deallost",
  "closedlostdeal",
];

const toSqlList = (values) => values.map((v) => `'${v}'`).join(", ");

export const buildDealStageFilters = (
  { dealstage = "dealstage", rawData = "raw_data" } = {}
) => {
  const normalizedStageSql = `lower(regexp_replace(coalesce(${dealstage}, ${rawData}->'properties'->>'dealstage', ''), '[^a-z0-9]+', '', 'g'))`;
  const isClosedWon = `coalesce(${rawData}->'properties'->>'hs_is_closed_won','false') = 'true'`;
  const isClosedLost = `coalesce(${rawData}->'properties'->>'hs_is_closed','false') = 'true' AND coalesce(${rawData}->'properties'->>'hs_is_closed_won','false') <> 'true'`;
  const wonFilter = `(${normalizedStageSql} IN (${toSqlList(
    wonStages
  )}) OR ${isClosedWon})`;
  const lostFilter = `(${normalizedStageSql} IN (${toSqlList(
    lostStages
  )}) OR ${isClosedLost})`;
  const closedFilter = `(${wonFilter} OR ${lostFilter})`;
  const openFilter = `NOT (${closedFilter})`;

  return {
    normalizedStageSql,
    wonFilter,
    lostFilter,
    closedFilter,
    openFilter,
  };
};

export const dealStageFilters = buildDealStageFilters();
