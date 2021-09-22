/**
 * Users of this class should implement handle() method. This method should throw Https error when
 * guard is not succeeded. Guard can be a future.
 */
import {ExtendedContext, JSONValue} from "./index";

export abstract class Guard {
    /**
     * All guards should implement handle function which resolves to completed void Promise or
     * throws Https error.
     * @param data refer to firebase functions docs
     * @param context refer to firebase functions docs
     */
    abstract handle(data: JSONValue, context: ExtendedContext): Promise<void>;
}
