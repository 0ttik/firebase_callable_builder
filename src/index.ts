/* eslint-disable @typescript-eslint/no-explicit-any */

import {region, Runnable, SUPPORTED_REGIONS, TriggerAnnotated} from "firebase-functions";
import {JTDSchemaType, SomeJTDSchemaType} from "ajv/dist/types/jtd-schema";
import {CallableContext, HttpsError} from "firebase-functions/lib/providers/https";
import Ajv, {AsyncValidateFunction, ValidateFunction} from "ajv/dist/jtd";
import {ParamsDictionary} from 'express-serve-static-core';
import {Request, Response} from "express/ts4.0";
import {Guard} from "./guard";

/* reason: this types are from firebase functions library so it's just a copy of their types */
export type FirebaseFunctionsRegions = Array<typeof SUPPORTED_REGIONS[number] | string>;
export type FirebaseFunctionsCallableExpress =
    ((req: Request<ParamsDictionary>, resp: Response<any>) => void | Promise<void>);
export type FirebaseFunctionsCallable = TriggerAnnotated
    & FirebaseFunctionsCallableExpress
    & Runnable<any>;
/* eslint-enable @typescript-eslint/no-explicit-any */

export {SomeJTDSchemaType, JTDDataType} from "ajv/dist/types/jtd-schema";

export {Guard} from "./guard";

export interface FunctionsBuilderParams {
    defaultRegions: FirebaseFunctionsRegions;
    guards: Guard[];
    /**
     * Initial schemas which are going to be precompiled and available by name.
     * In format <name>:<schema>
     */
    schemas: {
        [key: string]: SomeJTDSchemaType
    };
}

export type ExtendedContext = CallableContext & {
    endpointName?: string;
};

export type JSONValue =
    | string
    | number
    | boolean
    | null
    | JSONValue[]
    | { [key: string]: JSONValue };

export interface JSONObject {
    [k: string]: JSONValue
}

/**
 * Builder class for firebase callable functions. Acts as singleton. Properties can be changed by
 * withConfig() method which returns new configured instance.
 */
export class FunctionsBuilder {
    private static _instance: FunctionsBuilder;
    private static ajv: Ajv;
    private readonly params: FunctionsBuilderParams;

    /**
     * Creates new instance internally to force factory/singleton patterns.
     * @param params
     */
    private constructor(params: FunctionsBuilderParams) {
        this.params = params;
    }

    /**
     * Gets instance of CallableBuilder on which build method can be called.
     */
    static get instance(): FunctionsBuilder {
        if (!this._instance) {
            throw new Error('Trying to get CallableBuilder instance when it\'s not initialized.');
        }
        return this._instance;
    }

    /**
     * Called to initialize CallableBuilder singleton class so it is ready to functions.
     * @param params
     */
    static init(params: FunctionsBuilderParams): void {
        if (this._instance) {
            throw new Error('Trying to initialize CallableBuilder when it\'s already initialized.');
        }
        this.ajv = new Ajv();
        for (const key in params.schemas) {
            if (Object.prototype.hasOwnProperty.call(params.schemas, key)) {
                this.ajv.addSchema(params.schemas[key], key);
            }
        }
        this._instance = new FunctionsBuilder(params);
    }

    /**
     * Copy this instance optionally changing parameters.
     * @returns builder new callable builder with passed properties
     * @param params
     */
    withConfig(params: Partial<FunctionsBuilderParams>): FunctionsBuilder {
        return new FunctionsBuilder(Object.assign({}, this.params, params));
    }

    /**
     * Builds new callable function.
     *
     * This function validates input. If input is not valid, it throws HTTPs error with
     * 'invalid-argument' code and 'schema' details object code containing errors object with
     * the description of the validation errors in ajv-style.
     *
     * @param handler function handler which is gonna be called on function call
     * @param schema JTD schema or string referring to schema name (should be preloaded in init)
     * @returns callable new callable function ready for export (see firebase functions docs)
     */
    buildCallable<T>(
        handler: (data: T, context: ExtendedContext) => JSONValue | Promise<JSONValue>,
        schema: JTDSchemaType<T> | string,
    ): FirebaseFunctionsCallable {
        return region(...this.params.defaultRegions)
            .https
            .onCall(async (data: JSONObject, context: CallableContext) => {
                const extendedContext: ExtendedContext = context;
                let validate: ValidateFunction<T> | AsyncValidateFunction<T> | undefined;
                if (typeof schema === 'string') {
                    validate = FunctionsBuilder.ajv.getSchema<T>(schema);
                    if (!validate) {
                        throw new Error('State error: could not find schema by name: ' + schema);
                    }
                    extendedContext.endpointName = schema;
                } else {
                    validate = FunctionsBuilder.ajv.compile<T>(schema);
                }
                if (!validate(data)) {
                    throw new HttpsError('invalid-argument',
                        'Details object contains more info.',
                        {
                            code: 'schema',
                            details: validate.errors,
                        }
                    );
                }
                for (const guard of this.params.guards) {
                    await guard.handle(data, extendedContext);
                }
                return handler(data, extendedContext);
            });
    }
}