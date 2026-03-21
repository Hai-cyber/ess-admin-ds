export default {
  async fetch(request) {
    return Response.json({
      worker: 'control-plane',
      status: 'scaffolded',
      message: 'Operator control-plane worker scaffold.'
    });
  }
};
