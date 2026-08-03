export const DELIVERY_STATUS_STORAGE_KEY =
  "socialmediaautomator.deliveryStatuses.v1";

export type DeliveryOperationalStatus = "ready" | "published" | "archived";

export const deliveryOperationalStatusLabels: Record<
  DeliveryOperationalStatus,
  string
> = {
  ready: "Pronto",
  published: "Publicado manualmente",
  archived: "Arquivado",
};

export type DeliveryStatusMap = Record<string, DeliveryOperationalStatus>;

export function readDeliveryStatuses(): DeliveryStatusMap {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    return normalizeDeliveryStatuses(
      JSON.parse(window.localStorage.getItem(DELIVERY_STATUS_STORAGE_KEY) || "{}"),
    );
  } catch {
    return {};
  }
}

export function writeDeliveryStatus(
  deliveryId: string,
  status: DeliveryOperationalStatus,
) {
  if (typeof window === "undefined") {
    return {};
  }

  const statuses = {
    ...readDeliveryStatuses(),
    [deliveryId]: status,
  };

  window.localStorage.setItem(
    DELIVERY_STATUS_STORAGE_KEY,
    JSON.stringify(statuses),
  );

  return statuses;
}

export function getDeliveryStatus(
  statuses: DeliveryStatusMap,
  deliveryId: string,
) {
  return statuses[deliveryId] || "ready";
}

function normalizeDeliveryStatuses(value: unknown): DeliveryStatusMap {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<DeliveryStatusMap>(
    (statuses, [deliveryId, status]) => {
      if (isDeliveryOperationalStatus(status)) {
        statuses[deliveryId] = status;
      }

      return statuses;
    },
    {},
  );
}

function isDeliveryOperationalStatus(
  value: unknown,
): value is DeliveryOperationalStatus {
  return value === "ready" || value === "published" || value === "archived";
}
