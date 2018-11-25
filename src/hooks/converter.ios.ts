import * as fs from "fs";
import * as path from "path";
import * as plist from "simple-plist";

import { ConverterCommon } from "./converter.common";
import { DataProvider, I18nEntries, Languages } from "./data.provider";
import { encodeKey, encodeValue } from "../resource.ios";

export class ConverterIOS extends ConverterCommon {
  protected cleanObsoleteResourcesFiles(resourcesDirectory: string, languages: Languages): this {
    fs.readdirSync(resourcesDirectory).filter(fileName => {
      const match = /^(.+)\.lproj$/.exec(fileName);
      return match && !languages.has(match[1]);
    }).map(fileName => {
      return path.join(resourcesDirectory, fileName);
    }).filter(filePath => {
      return fs.statSync(filePath).isDirectory();
    }).forEach(lngResourcesDir => {
      ["InfoPlist.strings", "Localizable.strings"].forEach(fileName => {
        const resourceFilePath = path.join(lngResourcesDir, fileName);
        this.removeFileIfExists(resourceFilePath);
      });
      this.removeDirectoryIfEmpty(lngResourcesDir);
    });
    return this;
  }

  protected createLanguageResourcesFiles(
    language: string,
    isDefaultLanguage: boolean,
    i18nEntries: I18nEntries
  ): this {
    const infoPlistStrings: I18nEntries = new Map();
    i18nEntries.forEach((value, key) => {
      if (key === "app.name") {
        infoPlistStrings.set("CFBundleDisplayName", value);
        infoPlistStrings.set("CFBundleName", value);
      } else if (key.startsWith("ios.info.plist.")) {
        infoPlistStrings.set(key.substr(15), value);
      }
    });
    const languageResourcesDir = path.join(this.appResourcesDirectoryPath, `${language}.lproj`);
    this
      .createDirectoryIfNeeded(languageResourcesDir)
      .writeStrings(languageResourcesDir, "Localizable.strings", i18nEntries, true)
      .writeStrings(languageResourcesDir, "InfoPlist.strings", infoPlistStrings, false)
    ;
    if (isDefaultLanguage) {
      infoPlistStrings.set("CFBundleDevelopmentRegion", language);
      this.writeInfoPlist(infoPlistStrings);
    }
    return this;
  }

  private writeStrings(
    languageResourcesDir: string,
    resourceFileName: string,
    strings: I18nEntries,
    encodeKeys: boolean
  ): this {
    let content = "";
    strings.forEach((value, key) => {
      content += `"${encodeKeys ? encodeKey(key) : key}" = "${encodeValue(value)}";\n`;
    });
    const resourceFilePath = path.join(languageResourcesDir, resourceFileName);
    this.writeFileSyncIfNeeded(resourceFilePath, content);
    return this;
  }

  private writeInfoPlist(infoPlistValues: I18nEntries) {
    const resourceFilePath = path.join(this.appResourcesDirectoryPath, "Info.plist");
    if (!fs.existsSync(resourceFilePath)) {
      this.logger.warn(`'${resourceFilePath}' doesn't exists: unable to set default language`);
      return this;
    }
    const data = plist.readFileSync(resourceFilePath);
    let resourceChanged = false;
    infoPlistValues.forEach((value, key) => {
      if (!data.hasOwnProperty(key) || data[key] !== value) {
        data[key] = value;
        resourceChanged = true;
      }
    });
    if (resourceChanged) {
      plist.writeFileSync(resourceFilePath, data);
    }
  }
}