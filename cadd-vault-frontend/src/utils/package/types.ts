export interface PackageTag {
  id: string;
  name: string;
  category?: string;
}

export interface ParsedPackageData {
  name: string;
  description: string;
  tags: string[];
  urls: {
    repository?: string;
    publication?: string;
    webserver?: string;
    other?: string;
  };
}