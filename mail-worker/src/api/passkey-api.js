import app from '../hono/hono';
import passkeyService from '../service/passkey-service';
import result from '../model/result';
import userContext from '../security/user-context';

app.post('/passkey/register/options', async (c) => {
    const userId = userContext.getUserId(c);
    const user = userContext.getUser(c);
    const options = await passkeyService.generateRegistrationOptions(c, userId, user.email);
    return c.json(result.ok(options));
});

app.post('/passkey/register/verify', async (c) => {
    const userId = userContext.getUserId(c);
    const body = await c.req.json();
    const data = await passkeyService.verifyRegistration(c, userId, body.credential, body.name);
    return c.json(result.ok(data));
});

app.post('/passkey/login/options', async (c) => {
    const options = await passkeyService.generateAuthenticationOptions(c);
    return c.json(result.ok(options));
});

app.post('/passkey/login/verify', async (c) => {
    const body = await c.req.json();
    const data = await passkeyService.verifyAuthentication(c, body.credential);
    return c.json(result.ok(data));
});

app.get('/passkey/list', async (c) => {
    const userId = userContext.getUserId(c);
    const list = await passkeyService.listByUserId(c, userId);
    return c.json(result.ok(list));
});

app.delete('/passkey/delete/:id', async (c) => {
    const userId = userContext.getUserId(c);
    const { id } = c.req.param();
    await passkeyService.deleteById(c, userId, Number(id));
    return c.json(result.ok());
});
