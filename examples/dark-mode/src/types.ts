// Example of how to extend GlobalStateInitialValues for type safety in your app
// for state initialization

declare module "orbo" {
  interface GlobalStateInitialValues {
    cookies: {
      darkMode?: string;
      theme?: "light" | "dark";
    };
    user?: {
      id: string;
      name: string;
      preferences: Record<string, any>;
    };
    config?: {
      apiUrl: string;
      environment: "development" | "production";
    };
  }
}
