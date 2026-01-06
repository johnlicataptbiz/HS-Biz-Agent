export const normalizedStageSql =
  "lower(regexp_replace(coalesce(dealstage, ''), '[^a-z0-9]+', '', 'g'))";

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

export const wonFilter = `${normalizedStageSql} IN (${toSqlList(wonStages)})`;
export const lostFilter = `${normalizedStageSql} IN (${toSqlList(lostStages)})`;
export const closedFilter = `(${wonFilter} OR ${lostFilter})`;
export const openFilter = `NOT (${closedFilter})`;

export const dealStageFilters = {
  normalizedStageSql,
  wonFilter,
  lostFilter,
  closedFilter,
  openFilter,
};
