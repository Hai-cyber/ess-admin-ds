export default {
  async fetch(request) {
    return Response.json({
      worker: 'sms',
      status: 'scaffolded',
      message: 'SMS worker scaffold.'
    });
  }
};
