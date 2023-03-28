import { readFile } from "fs/promises";

export class Csv<T> {

    columns: CsvColumnMapping<any>[];
    options: CsvOptions;

    constructor(options: Partial<CsvOptions> = {}) {
        const defaultOptions = {
            delimiter: "\t"
        };
        this.options = { ...defaultOptions, ...options }
        this.columns = [];
    }

    column<TResult = string>(
        from: string,
        to: keyof T,
        mapping: ((data: string, fullRow: { [key: string]: string }) => TResult) | undefined = undefined): Csv<T> {

        if (this.getColumnMapping(from)) {
            throw new Error("Mapping already defined");
        }

        this.columns.push(new CsvColumnMapping<T, any>(from, to, mapping))

        return this;
    }

    text(from: string, to: keyof T, mapping: ((data: string, fullRow: { [key: string]: string }) => string) | undefined = undefined): Csv<T> {
        return this.column(from, to, mapping);
    }

    int(from: string, to: keyof T, mapping: ((data: number, original: string, fullRow: { [key: string]: string }) => number) | undefined = undefined): Csv<T> {
        return this.float(from, to, (a: any, b: any, c: any): any => {            
            return (mapping || identity)(Math.floor(a), b, c);
        });
    }

    float(from: string, to: keyof T, mapping: ((data: number, original: string, fullRow: { [key: string]: string }) => number) | undefined = undefined): Csv<T> {

        const _mapping: ((data: number, original: string, fullRow: { [key: string]: string }) => number) = mapping || identity;

        return this.column(from, to, (field, fullRow) => {
            const r =  _mapping(Number(field.replace(",", ".")), field, fullRow);
            return r;
        })

    }



    enumText<TEnum extends { [key in keyof TEnum]: any }>(from: string, to: keyof T, enumObj: EnumType<TEnum>, mapping: ((data: ValueOf<TEnum>, original: string, fullRow: { [key: string]: string }) => TEnum) | undefined = undefined): Csv<T> {

        const _mapping: ((data: ValueOf<TEnum>, original: string, fullRow: { [key: string]: string }) => TEnum) = mapping || identity;

        return this.column(from, to, (field, fullRow) => {

            const entries = Object.entries<any>(enumObj);

            let selectedEntry = entries.find(([key]) => key === field.trim())
            if (!selectedEntry) {
                selectedEntry = entries.find(([key]) => key.toLowerCase() === field.trim().toLowerCase())
            }

            let enumValue: ValueOf<TEnum> | undefined = undefined;

            if (selectedEntry) {
                enumValue = enumObj[selectedEntry[0] as any as keyof TEnum]
            }
            return _mapping(enumValue!, field, fullRow);
        })

    }
    enumValue<TEnum extends { [key in keyof TEnum]: any }>(from: string, to: keyof T, enumObj: EnumType<TEnum>, mapping: ((data: ValueOf<TEnum>, original: string, fullRow: { [key: string]: string }) => TEnum) | undefined = undefined): Csv<T> {

        const _mapping: ((data: ValueOf<TEnum>, original: string, fullRow: { [key: string]: string }) => TEnum) = mapping || identity;

        return this.column(from, to, (field, fullRow) => {

            const entries = Object.entries<any>(enumObj);

            let selectedEntry = entries.find(([, value]) => value == field.trim())
            if (!selectedEntry) {
                selectedEntry = entries.find(([, value]) => value == field.trim().toLowerCase())
            }

            let enumValue: ValueOf<TEnum> | undefined = undefined;

            if (selectedEntry) {
                enumValue = enumObj[selectedEntry[0] as any as keyof TEnum]
            }
            return _mapping(enumValue!, field, fullRow);
        })

    }
    private getColumnMapping(from: string): CsvColumnMapping<T> | undefined | null {
        
        const col =  this.columns.find(x => x.from.trim() === from.trim());       
        return col;
    }

    async parseFile(csvPath: string): Promise<T[]> {
        const csvString = await readFile(csvPath, "utf-8");
        return this.parseString(csvString);

    }

    public parseString(csvString: string): T[] {

        const [header, ...lines] = csvString.split("\n");

        const headerNames = header.split(this.options.delimiter).map(x => x.trim());
     
        const linesHash: Array<{ [key: string]: string }> = lines.map(line => {
            const cells = line.split(this.options.delimiter);

            const obj = headerNames.reduce((result, header, index) => {
                return { ...result, [header]: cells[index] }
            }, {});

            return obj;
        });

        return linesHash.map(lineHash => {

            const entries = Object.entries(lineHash);

            return entries.reduce((item, [entryName, entryValue]) => {

                const column = this.getColumnMapping(entryName);

                if (!column) return item;

                
                return { ...item, [column.to]: column.mapping(entryValue, lineHash) }

            }, {}) as T;

        })

    }

}

class CsvColumnMapping<T, TResult = string> {

    constructor(
        public from: string,
        public to: keyof T,
        public mapping: (data: string, fullRow: { [key: string]: string }) => TResult = identity
    ) { }

}

type CsvOptions = {
    delimiter: string
}

type ValueOf<T> = T[keyof T];

type EnumType<TEnum extends { [key in keyof TEnum]: any }> = { [key in keyof TEnum]: any };

const identity = (x: any) => x;