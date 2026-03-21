export default {
  async fetch(request) {
    return Response.json({
      worker: 'payments',
      status: 'scaffolded',
      message: 'Payments worker scaffold.'
    });
  }
};
