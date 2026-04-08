export default {
  async fetch(_request) {
    return Response.json({
      worker: 'payments',
      status: 'scaffolded',
      message: 'Payments worker scaffold.'
    });
  }
};
