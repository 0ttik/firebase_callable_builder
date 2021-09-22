# Features

* Ajv validation with JTD schema
* Type safety
* Region selection
* Flexible settings copy
* Guards

# Usage example

```typescript

FunctionsBuilder.init({
    defaultRegions: ['europe-west3'],
    schemas: {registerUserSchema},
    guards: [AuthGuard()],
});

const registerUserSchema = {
    properties: {
        name: {type: 'string'},
        email: {type: 'string'},
        password: {type: 'string'},
        phone: {type: 'string'},
    },
} as const;

export const registerUser = FunctionsBuilder.instance
    .buildCallable<JTDDataType<typeof registerUserSchema>>(
        async (data) => {
            // ...
        }, 'registerUserSchema');
```