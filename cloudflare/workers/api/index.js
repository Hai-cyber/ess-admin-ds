export default {
  async fetch(request) {
    return Response.json({
      worker: 'api',
      status: 'scaffolded',
      message: 'Core tenant API worker scaffold.'
    });
  }
};
